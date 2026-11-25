-- JH FINANZAS · INSTALACIÓN COMPLETA (todo en uno, probado).
-- Supabase → SQL Editor → New query → pegar TODO → Run. Se puede correr varias veces.

create extension if not exists pgcrypto;

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  usd_rate numeric(12,2) not null default 4000,
  display_name text,
  theme_color text not null default '#1E5B5A',
  debt_categories text[] not null default array['Préstamo','Venta a crédito','Proveedor','Tarjeta o crédito bancario','Arriendo','Otro'],
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null default '#1E5B5A',
  partner_name text,
  partner_share numeric(5,2) not null default 0 check (partner_share between 0 and 100),
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  kind text not null check (kind in ('income','expense')),
  name text not null,
  special text,
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  business_id uuid not null references public.businesses on delete restrict,
  name text not null,
  type text not null default 'bank' check (type in ('bank','pocket','cash','card','other')),
  bank text,
  currency text not null default 'COP' check (currency in ('COP','USD')),
  initial_balance numeric(16,2) not null default 0,
  min_balance numeric(16,2),
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  direction text not null check (direction in ('owe','owed')),
  person text not null,
  description text,
  category text,
  business_id uuid not null references public.businesses on delete restrict,
  currency text not null default 'COP' check (currency in ('COP','USD')),
  total_amount numeric(16,2) not null check (total_amount > 0),
  installment numeric(16,2),
  due_day int check (due_day between 1 and 31),
  start_date date not null default current_date,
  note text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('expense','income')),
  amount numeric(16,2) not null check (amount > 0),
  business_id uuid not null references public.businesses on delete restrict,
  category_id uuid references public.categories on delete set null,
  account_id uuid references public.accounts on delete set null,
  day_of_month int not null default 1 check (day_of_month between 1 and 31),
  note text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('expense','income','transfer','debt_in','debt_out')),
  date date not null default current_date,
  amount numeric(16,2) not null check (amount > 0),
  account_id uuid references public.accounts on delete restrict,
  to_account_id uuid references public.accounts on delete restrict,
  to_amount numeric(16,2) check (to_amount is null or to_amount > 0),
  business_id uuid references public.businesses on delete set null,
  category_id uuid references public.categories on delete set null,
  description text,
  note text,
  fx_rate numeric(12,2),
  amount_cop numeric(16,2),
  status text not null default 'confirmed' check (status in ('confirmed','pending')),
  source text not null default 'manual',
  raw_text text,
  debt_id uuid references public.debts on delete set null,
  debt_role text check (debt_role in ('disbursement','payment')),
  recurring_id uuid references public.recurring_payments on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tx_account_required check (status = 'pending' or account_id is not null),
  constraint tx_transfer_target check (kind <> 'transfer' or status = 'pending' or (to_account_id is not null and to_account_id <> account_id))
);

create index if not exists tx_user_date_idx on public.transactions (user_id, date desc);
create index if not exists tx_account_idx on public.transactions (account_id);
create index if not exists tx_to_account_idx on public.transactions (to_account_id);
create index if not exists tx_debt_idx on public.transactions (debt_id);
create index if not exists tx_recurring_idx on public.transactions (recurring_id, date);

create or replace function public.jh_tx_before_save() returns trigger
language plpgsql security invoker set search_path = public as $$
declare cur text; cur2 text; rate numeric;
begin
  new.updated_at := now();
  if new.account_id is not null then
    select currency into cur from accounts where id = new.account_id and user_id = new.user_id;
    if cur is null then raise exception 'Cuenta no encontrada'; end if;
  end if;
  if new.to_account_id is not null then
    select currency into cur2 from accounts where id = new.to_account_id and user_id = new.user_id;
    if cur2 is null then raise exception 'Cuenta destino no encontrada'; end if;
    if cur2 = coalesce(cur, 'COP') then new.to_amount := new.amount;
    elsif new.to_amount is null then raise exception 'Indica cuánto llegó a la cuenta destino';
    end if;
  end if;
  if new.kind <> 'transfer' then new.to_account_id := null; new.to_amount := null; end if;
  if new.kind not in ('income','expense') then new.category_id := null; end if;
  if new.kind not in ('debt_in','debt_out') then new.debt_id := null; new.debt_role := null; end if;
  if coalesce(cur, 'COP') = 'USD' then
    if new.fx_rate is null then
      select usd_rate into rate from settings where user_id = new.user_id;
      new.fx_rate := coalesce(rate, 4000);
    end if;
    new.amount_cop := round(new.amount * new.fx_rate);
  else
    new.fx_rate := null;
    new.amount_cop := new.amount;
  end if;
  return new;
end $$;

drop trigger if exists jh_tx_before_save on public.transactions;
create trigger jh_tx_before_save before insert or update on public.transactions
  for each row execute function public.jh_tx_before_save();

create or replace view public.account_balances with (security_invoker = true) as
select a.id as account_id,
  a.initial_balance
  + coalesce((select sum(case when t.kind in ('income','debt_in') then t.amount else -t.amount end)
      from transactions t where t.account_id = a.id and t.status = 'confirmed'), 0)
  + coalesce((select sum(t.to_amount)
      from transactions t where t.to_account_id = a.id and t.kind = 'transfer' and t.status = 'confirmed'), 0)
  as balance
from accounts a;

create or replace view public.debt_balances with (security_invoker = true) as
select d.id as debt_id,
  coalesce(sum(t.amount) filter (where t.debt_role = 'payment' and t.status = 'confirmed'), 0) as paid
from debts d left join transactions t on t.debt_id = d.id
group by d.id;

do $$
declare t text;
begin
  foreach t in array array['settings','businesses','categories','accounts','transactions','debts','recurring_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo_dueno" on public.%I', t);
    execute format('create policy "solo_dueno" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
revoke all on public.account_balances from anon;
revoke all on public.debt_balances from anon;

create or replace function public.jh_seed() returns void
language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid(); b uuid;
begin
  if uid is null then raise exception 'Debes iniciar sesión'; end if;
  insert into settings (user_id) values (uid) on conflict (user_id) do nothing;
  if exists (select 1 from businesses where user_id = uid) then return; end if;

  insert into businesses (user_id, name, color, sort) values (uid, 'JH Autos', '#1E5B5A', 1) returning id into b;
  insert into categories (user_id, business_id, kind, name, sort) select uid, b, 'income', n, o from unnest(array['Venta de vehículo','Comisión por consignación','Trámites y documentos','Cambio de divisas','Otros']) with ordinality as x(n, o);
  insert into categories (user_id, business_id, kind, name, sort) select uid, b, 'expense', n, o from unnest(array['Compra de vehículo','Meta Ads y publicidad','Comisiones pagadas','Alistamiento y taller','Traspasos y trámites','Atención a clientes','Equipos','Oficina','Plan de datos y suscripciones','Otros']) with ordinality as x(n, o);

  insert into businesses (user_id, name, color, sort) values (uid, 'Personal', '#6E7B3C', 2) returning id into b;
  insert into categories (user_id, business_id, kind, name, sort) select uid, b, 'income', n, o from unnest(array['Ingresos extra','Otros']) with ordinality as x(n, o);
  insert into categories (user_id, business_id, kind, name, sort) select uid, b, 'expense', n, o from unnest(array['Vivienda y administración','Servicios (luz, agua, gas, internet)','Mercado','Comida y domicilios','Gasolina y transporte','Moto y carro','Suscripciones','Cuotas y tarjetas','Salud','Ropa','Salidas','Aseo','Familia','Otros']) with ordinality as x(n, o);

  insert into businesses (user_id, name, color, partner_name, partner_share, sort) values (uid, 'JH Bikes', '#2F7F86', 'Socio', 40, 3) returning id into b;
  insert into categories (user_id, business_id, kind, name, sort) select uid, b, 'income', n, o from unnest(array['Venta de moto','Otros']) with ordinality as x(n, o);
  insert into categories (user_id, business_id, kind, name, sort) select uid, b, 'expense', n, o from unnest(array['Compra de moto','Mantenimiento y repuestos','Peritajes','Traspasos y trámites','Publicidad','Plan de datos','Utilidad socio','Otros']) with ordinality as x(n, o);
  update categories set special = 'partner_payout' where business_id = b and name = 'Utilidad socio';

  insert into businesses (user_id, name, color, sort) values (uid, 'Oro', '#A88A3D', 4) returning id into b;
  insert into categories (user_id, business_id, kind, name, sort) select uid, b, 'income', n, o from unnest(array['Venta de oro','Otros']) with ordinality as x(n, o);
  insert into categories (user_id, business_id, kind, name, sort) select uid, b, 'expense', n, o from unnest(array['Compra de oro','Comisiones','Transporte y envíos','Otros']) with ordinality as x(n, o);
end $$;

revoke all on function public.jh_seed() from anon, public;
grant execute on function public.jh_seed() to authenticated;

-- Tarjetas de crédito (cupo, sobrecupo, corte, pago y parte en dólares)
alter table public.accounts add column if not exists credit_limit numeric(16,2);
alter table public.accounts add column if not exists overlimit_pct numeric(5,2) not null default 0;
alter table public.accounts add column if not exists cut_day int check (cut_day between 1 and 31);
alter table public.accounts add column if not exists pay_day int check (pay_day between 1 and 31);
alter table public.accounts add column if not exists card_fx_rate numeric(12,2);
alter table public.accounts add column if not exists parent_id uuid references public.accounts on delete cascade;

create table if not exists public.assets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  name           text not null,
  category       text not null default 'Otro',
  business_id    uuid not null references public.businesses on delete restrict,
  cost           numeric(16,2) not null default 0,      -- precio costo
  sale_price     numeric(16,2),                          -- posible precio de venta
  partner_name   text,                                   -- otra persona con parte en el activo
  partner_amount numeric(16,2),                          -- cuánto le corresponde de la venta
  detail         text,                                   -- ej. gramos, placa, modelo
  note           text,
  acquired_date  date,
  status         text not null default 'active' check (status in ('active','sold')),
  sold_price     numeric(16,2),
  sold_date      date,
  sort           int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists assets_user_idx on public.assets (user_id, status);

alter table public.assets enable row level security;
drop policy if exists "solo_dueno" on public.assets;
create policy "solo_dueno" on public.assets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.assets from anon;
grant select, insert, update, delete on public.assets to authenticated;

-- Deudas que se guardan pero no suman en "Yo debo" (inviables / aparte)
alter table public.debts add column if not exists excluded boolean not null default false;

alter table public.debts add column if not exists next_due date;


create table if not exists public.ingest_tokens (
  user_id    uuid primary key references auth.users on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.ingest_tokens enable row level security;   -- sin políticas: solo lo usan las funciones de abajo
revoke all on public.ingest_tokens from anon, authenticated;

-- Crea (o cambia) tu token secreto. Devuelve el token una sola vez.
create or replace function public.jh_new_ingest_token() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Debes iniciar sesión'; end if;
  t := encode(gen_random_bytes(18), 'hex');
  insert into ingest_tokens (user_id, token_hash) values (uid, encode(digest(t, 'sha256'), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now();
  return t;
end $$;
revoke all on function public.jh_new_ingest_token() from public, anon;
grant execute on function public.jh_new_ingest_token() to authenticated;

create or replace function public.jh_has_ingest_token() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from ingest_tokens where user_id = auth.uid());
$$;
revoke all on function public.jh_has_ingest_token() from public, anon;
grant execute on function public.jh_has_ingest_token() to authenticated;

-- Recibe un movimiento del Atajo. Valida el token y lo guarda como pendiente.
-- Si en los últimos 15 minutos ya llegó uno igual (mismo monto, ej. Apple Pay + SMS de la misma compra), no lo repite.
create or replace function public.jh_ingest(p_token text, p_kind text, p_amount numeric, p_description text, p_raw text, p_source text, p_date date)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid; existing uuid; new_id uuid;
begin
  select user_id into uid from ingest_tokens where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if uid is null then raise exception 'Token inválido'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Monto inválido'; end if;

  select id into existing from transactions
   where user_id = uid and status = 'pending' and amount = p_amount
     and created_at > now() - interval '15 minutes'
   order by created_at desc limit 1;
  if existing is not null then
    update transactions
       set raw_text = left(coalesce(raw_text, '') || E'\n' || coalesce(p_raw, ''), 2000),
           description = coalesce(nullif(description, ''), left(p_description, 120))
     where id = existing;
    return existing;
  end if;

  insert into transactions (user_id, kind, date, amount, description, raw_text, source, status)
  values (uid, case when p_kind = 'income' then 'income' else 'expense' end, coalesce(p_date, current_date), p_amount,
          left(nullif(p_description, ''), 120), left(p_raw, 2000), left(coalesce(p_source, 'atajo'), 20), 'pending')
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.jh_ingest(text, text, numeric, text, text, text, date) from public;
grant execute on function public.jh_ingest(text, text, numeric, text, text, text, date) to anon, authenticated;


-- Listas para los menús del Atajo (cuentas o negocios), validando el token.
create or replace function public.jh_ingest_lists(p_token text, p_what text)
returns text[]
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid; out text[];
begin
  select user_id into uid from ingest_tokens where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if uid is null then raise exception 'Token inválido'; end if;
  if p_what = 'negocios' then
    select array_agg(name order by sort, created_at) into out from businesses where user_id = uid and not archived;
  else
    -- cuentas con plata primero, luego tarjetas (sin la parte en dólares de las tarjetas)
    select array_agg(name order by (type = 'card'), sort, created_at) into out
      from accounts where user_id = uid and not archived and parent_id is null;
  end if;
  return coalesce(out, array[]::text[]);
end $$;
revoke all on function public.jh_ingest_lists(text, text) from public;
grant execute on function public.jh_ingest_lists(text, text) to anon, authenticated;

-- Recibe el movimiento. Si trae cuenta y negocio, queda registrado de una vez con la categoría más probable;
-- si no, queda en "Por clasificar". No duplica si la misma compra llega por Apple Pay y por SMS.
create or replace function public.jh_ingest_v2(
  p_token text, p_kind text, p_amount numeric, p_description text, p_raw text, p_source text, p_date date,
  p_account text, p_business text, p_category_hints text[])
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid; acc_id uuid; acc_name text; biz_id uuid; biz_name text; cat_id uuid; cat_name text;
  existing uuid; new_id uuid; k text; hint text; first_word text;
begin
  select user_id into uid from ingest_tokens where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if uid is null then raise exception 'Token inválido'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Monto inválido'; end if;
  k := case when p_kind = 'income' then 'income' else 'expense' end;

  -- misma compra en los últimos 15 minutos (Apple Pay + SMS): se juntan
  select id into existing from transactions
   where user_id = uid and amount = p_amount and created_at > now() - interval '15 minutes'
     and source in ('applepay', 'sms', 'atajo', 'prueba')
   order by created_at desc limit 1;
  if existing is not null then
    update transactions set raw_text = left(coalesce(raw_text, '') || E'\n' || coalesce(p_raw, ''), 2000),
           description = coalesce(nullif(description, ''), left(p_description, 120))
     where id = existing;
    return json_build_object('id', existing, 'status', 'duplicado');
  end if;

  if nullif(trim(p_account), '') is not null then
    select id, name into acc_id, acc_name from accounts
     where user_id = uid and not archived and lower(name) = lower(trim(p_account)) limit 1;
  end if;
  if nullif(trim(p_business), '') is not null then
    select id, name into biz_id, biz_name from businesses
     where user_id = uid and not archived and lower(name) = lower(trim(p_business)) limit 1;
  end if;
  if biz_id is null and acc_id is not null and nullif(trim(p_business), '') is null then
    select business_id into biz_id from accounts where id = acc_id;
  end if;

  -- categoría: 1) la que usaste antes en ese comercio y negocio  2) palabras clave  3) Otros
  if biz_id is not null then
    first_word := split_part(trim(coalesce(p_description, '')), ' ', 1);
    if length(first_word) >= 3 then
      select t.category_id into cat_id from transactions t
       where t.user_id = uid and t.status = 'confirmed' and t.business_id = biz_id and t.kind = k
         and t.category_id is not null and t.description ilike first_word || '%'
       order by t.date desc, t.created_at desc limit 1;
    end if;
    if cat_id is null and p_category_hints is not null then
      foreach hint in array p_category_hints loop
        select id into cat_id from categories
         where business_id = biz_id and kind = k and not archived and name ilike '%' || hint || '%'
         order by sort limit 1;
        exit when cat_id is not null;
      end loop;
    end if;
    if cat_id is null then
      select id into cat_id from categories
       where business_id = biz_id and kind = k and not archived and name ilike 'otro%' order by sort limit 1;
    end if;
    select name into cat_name from categories where id = cat_id;
  end if;

  insert into transactions (user_id, kind, date, amount, description, raw_text, source, status, account_id, business_id, category_id)
  values (uid, k, coalesce(p_date, current_date), p_amount, left(nullif(p_description, ''), 120), left(p_raw, 2000),
          left(coalesce(p_source, 'atajo'), 20),
          case when acc_id is not null and biz_id is not null then 'confirmed' else 'pending' end,
          acc_id, biz_id, cat_id)
  returning id into new_id;

  return json_build_object(
    'id', new_id,
    'status', case when acc_id is not null and biz_id is not null then 'registrado' else 'por_clasificar' end,
    'cuenta', acc_name, 'negocio', (select name from businesses where id = biz_id), 'categoria', cat_name);
end $$;
revoke all on function public.jh_ingest_v2(text, text, numeric, text, text, text, date, text, text, text[]) from public;
grant execute on function public.jh_ingest_v2(text, text, numeric, text, text, text, date, text, text, text[]) to anon, authenticated;


create table if not exists public.ingest_log (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users on delete cascade,
  token_ok   boolean not null default false,
  payload    jsonb,
  result     text
);
alter table public.ingest_log enable row level security;   -- sin políticas: solo lo usan las funciones
revoke all on public.ingest_log from anon, authenticated;

create or replace function public.jh_ingest_log(p_token text, p_payload jsonb, p_result text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  select user_id into uid from ingest_tokens where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  insert into ingest_log (user_id, token_ok, payload, result) values (uid, uid is not null, p_payload, left(p_result, 500));
  delete from ingest_log where created_at < now() - interval '30 days';
end $$;
revoke all on function public.jh_ingest_log(text, jsonb, text) from public;
grant execute on function public.jh_ingest_log(text, jsonb, text) to anon, authenticated;

-- Menú de cuentas: bolsillos primero; se oculta la cuenta "madre" de un banco que tiene bolsillos
-- (los bolsillos ya pertenecen a esa cuenta), luego las demás cuentas y al final las tarjetas.
create or replace function public.jh_ingest_lists(p_token text, p_what text)
returns text[]
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid; out text[];
begin
  select user_id into uid from ingest_tokens where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if uid is null then raise exception 'Token inválido'; end if;
  if p_what = 'negocios' then
    select array_agg(name order by sort, created_at) into out from businesses where user_id = uid and not archived;
  else
    select array_agg(a.name order by
             case when a.type = 'pocket' then 0 when a.type = 'card' then 2 else 1 end, a.sort, a.created_at)
      into out
      from accounts a
     where a.user_id = uid and not a.archived and a.parent_id is null
       and not (a.type = 'bank' and a.bank is not null and exists (
             select 1 from accounts p where p.user_id = uid and not p.archived and p.type = 'pocket' and p.bank = a.bank));
  end if;
  return coalesce(out, array[]::text[]);
end $$;
revoke all on function public.jh_ingest_lists(text, text) from public;
grant execute on function public.jh_ingest_lists(text, text) to anon, authenticated;


-- Un pendiente puede llegar sin monto (lo completa el SMS)
alter table public.transactions drop constraint if exists transactions_amount_check;
alter table public.transactions add constraint transactions_amount_check check (amount > 0 or status = 'pending');

-- Memoria: tarjeta de Apple Pay → cuenta
create table if not exists public.card_accounts (
  user_id    uuid not null references auth.users on delete cascade,
  card_label text not null,
  account_id uuid not null references public.accounts on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_label)
);
alter table public.card_accounts enable row level security;
drop policy if exists "solo_dueno" on public.card_accounts;
create policy "solo_dueno" on public.card_accounts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.card_accounts from anon;
grant select, insert, update, delete on public.card_accounts to authenticated;

drop function if exists public.jh_ingest_lists(text, text);
drop function if exists public.jh_ingest_v2(text, text, numeric, text, text, text, date, text, text, text[]);

-- Menú: "Bolsillo · Negocio". Bolsillos primero, luego cuentas sin bolsillos, luego tarjetas.
-- Si se conoce la tarjeta, su cuenta va de primera con ★.
create or replace function public.jh_ingest_lists(p_token text, p_what text, p_card text default null)
returns text[]
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid; out text[]; fav uuid;
begin
  select user_id into uid from ingest_tokens where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if uid is null then raise exception 'Token inválido'; end if;
  if p_what = 'negocios' then
    select array_agg(name order by sort, created_at) into out from businesses where user_id = uid and not archived;
    return coalesce(out, array[]::text[]);
  end if;
  if nullif(trim(p_card), '') is not null then
    select account_id into fav from card_accounts where user_id = uid and lower(card_label) = lower(trim(p_card));
  end if;
  select array_agg(case when a.id = fav then '★ ' else '' end || a.name || ' · ' || b.name
                   order by (a.id = fav) desc,
                            case when a.type = 'pocket' then 0 when a.type = 'card' then 2 else 1 end, b.sort, a.sort, a.created_at)
    into out
    from accounts a join businesses b on b.id = a.business_id
   where a.user_id = uid and not a.archived and a.parent_id is null
     and not (a.type = 'bank' and a.bank is not null and exists (
           select 1 from accounts p where p.user_id = uid and not p.archived and p.type = 'pocket' and p.bank = a.bank));
  return coalesce(out, array[]::text[]);
end $$;
revoke all on function public.jh_ingest_lists(text, text, text) from public;
grant execute on function public.jh_ingest_lists(text, text, text) to anon, authenticated;

create or replace function public.jh_ingest_v2(
  p_token text, p_kind text, p_amount numeric, p_description text, p_raw text, p_source text, p_date date,
  p_account text, p_business text, p_category_hints text[], p_card text default null)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid; acc_id uuid; acc_name text; biz_id uuid; cat_id uuid; cat_name text;
  existing uuid; new_id uuid; k text; hint text; first_word text; acc_label text; card text;
  st text;
begin
  select user_id into uid from ingest_tokens where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if uid is null then raise exception 'Token inválido'; end if;
  k := case when p_kind = 'income' then 'income' else 'expense' end;
  p_amount := coalesce(p_amount, 0);
  card := nullif(trim(coalesce(p_card, '')), '');
  first_word := lower(split_part(trim(coalesce(p_description, '')), ' ', 1));

  -- 1) Ya llegó esta compra (Apple Pay + SMS): se juntan
  if p_amount > 0 then
    select id into existing from transactions
     where user_id = uid and amount = p_amount and created_at > now() - interval '15 minutes'
       and source in ('applepay', 'sms', 'atajo', 'prueba')
     order by created_at desc limit 1;
    if existing is not null then
      update transactions set raw_text = left(coalesce(raw_text, '') || E'\n' || coalesce(p_raw, ''), 2000),
             description = coalesce(nullif(description, ''), left(p_description, 120))
       where id = existing;
      return json_build_object('id', existing, 'status', 'duplicado');
    end if;
    -- 2) Apple Pay llegó antes sin monto: el SMS lo completa
    select id into existing from transactions
     where user_id = uid and status = 'pending' and amount = 0 and created_at > now() - interval '30 minutes'
       and (length(first_word) < 3 or lower(coalesce(description, '')) like '%' || first_word || '%')
     order by created_at desc limit 1;
    if existing is not null then
      update transactions
         set amount = p_amount,
             raw_text = left(coalesce(raw_text, '') || E'\n' || coalesce(p_raw, ''), 2000),
             status = case when account_id is not null and business_id is not null then 'confirmed' else 'pending' end
       where id = existing
       returning status into st;
      return json_build_object('id', existing, 'status', case when st = 'confirmed' then 'completado' else 'por_clasificar' end);
    end if;
  end if;

  -- Cuenta: la elegida en el menú ("Oficina · JH Autos" o "★ Oficina · JH Autos"), o la recordada para la tarjeta
  acc_label := nullif(trim(regexp_replace(coalesce(p_account, ''), '^★\s*', '')), '');
  if acc_label is not null and acc_label not ilike 'después%' then
    select a.id, a.name into acc_id, acc_name from accounts a
     where a.user_id = uid and not a.archived
       and (lower(a.name) = lower(acc_label) or lower(a.name) = lower(split_part(acc_label, ' · ', 1)))
     order by (lower(a.name) = lower(acc_label)) desc limit 1;
  end if;
  if acc_id is null and card is not null and (acc_label is null) then
    select ca.account_id, a.name into acc_id, acc_name from card_accounts ca join accounts a on a.id = ca.account_id
     where ca.user_id = uid and lower(ca.card_label) = lower(card) and not a.archived;
  end if;
  if acc_id is not null and card is not null then
    insert into card_accounts (user_id, card_label, account_id) values (uid, card, acc_id)
    on conflict (user_id, card_label) do update set account_id = excluded.account_id, updated_at = now();
  end if;

  -- Negocio: el elegido; si no, el que va en la etiqueta del menú; si no, el del bolsillo
  if nullif(trim(p_business), '') is not null and p_business not ilike 'después%' then
    select id into biz_id from businesses where user_id = uid and not archived and lower(name) = lower(trim(p_business)) limit 1;
  end if;
  if biz_id is null and acc_label is not null and position(' · ' in acc_label) > 0 then
    select id into biz_id from businesses where user_id = uid and not archived
       and lower(name) = lower(split_part(acc_label, ' · ', 2)) limit 1;
  end if;
  if biz_id is null and acc_id is not null then
    select business_id into biz_id from accounts where id = acc_id;
  end if;

  -- Categoría: 1) la que usaste antes en ese comercio y negocio  2) palabras clave  3) Otros
  if biz_id is not null then
    if length(first_word) >= 3 then
      select t.category_id into cat_id from transactions t
       where t.user_id = uid and t.status = 'confirmed' and t.business_id = biz_id and t.kind = k
         and t.category_id is not null and lower(t.description) like first_word || '%'
       order by t.date desc, t.created_at desc limit 1;
    end if;
    if cat_id is null and p_category_hints is not null then
      foreach hint in array p_category_hints loop
        select id into cat_id from categories
         where business_id = biz_id and kind = k and not archived and name ilike '%' || hint || '%'
         order by sort limit 1;
        exit when cat_id is not null;
      end loop;
    end if;
    if cat_id is null then
      select id into cat_id from categories
       where business_id = biz_id and kind = k and not archived and name ilike 'otro%' order by sort limit 1;
    end if;
    select name into cat_name from categories where id = cat_id;
  end if;

  st := case when acc_id is not null and biz_id is not null and p_amount > 0 then 'confirmed' else 'pending' end;
  insert into transactions (user_id, kind, date, amount, description, raw_text, source, status, account_id, business_id, category_id)
  values (uid, k, coalesce(p_date, current_date), p_amount, left(nullif(p_description, ''), 120), left(p_raw, 2000),
          left(coalesce(p_source, 'atajo'), 20), st, acc_id, biz_id, cat_id)
  returning id into new_id;

  return json_build_object(
    'id', new_id,
    'status', case when st = 'confirmed' then 'registrado' when p_amount = 0 then 'sin_monto' else 'por_clasificar' end,
    'cuenta', acc_name, 'negocio', (select name from businesses where id = biz_id), 'categoria', cat_name);
end $$;
revoke all on function public.jh_ingest_v2(text, text, numeric, text, text, text, date, text, text, text[], text) from public;
grant execute on function public.jh_ingest_v2(text, text, numeric, text, text, text, date, text, text, text[], text) to anon, authenticated;


-- Presupuestos: cuánto quieres gastar al mes en una categoría (ej. Gasolina 400.000)
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  category_id uuid references public.categories on delete cascade,   -- vacío = todo el negocio
  name        text,
  amount      numeric(16,2) not null check (amount > 0),
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists budgets_user_idx on public.budgets (user_id);
alter table public.budgets enable row level security;
drop policy if exists "solo_dueno" on public.budgets;
create policy "solo_dueno" on public.budgets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.budgets from anon;
grant select, insert, update, delete on public.budgets to authenticated;

-- Interés mensual de una deuda (opcional) para saber cuál conviene pagar primero
alter table public.debts add column if not exists interest_rate numeric(6,3);

-- Cuota mensual que pagas de cada tarjeta (opcional; si no, se usa la deuda total)
alter table public.accounts add column if not exists monthly_payment numeric(16,2);

-- Preferencias del plan: sueldo, % de ahorro, cuenta del fondo de emergencia, etc.
alter table public.settings add column if not exists plan jsonb not null default '{}'::jsonb;

-- Permisos para el usuario que inicia sesión (los proyectos nuevos de Supabase no los dan por defecto).
-- La seguridad por fila (RLS) sigue limitando cada tabla a los datos de su dueño.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
