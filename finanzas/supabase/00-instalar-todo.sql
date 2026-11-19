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

-- Permisos para el usuario que inicia sesión (los proyectos nuevos de Supabase no los dan por defecto).
-- La seguridad por fila (RLS) sigue limitando cada tabla a los datos de su dueño.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
