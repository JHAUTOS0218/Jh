-- JH FINANZAS · Atajo inteligente:
--  · Recuerda qué tarjeta va con qué cuenta.
--  · Menú de bolsillos con su negocio ("Oficina · JH Autos"); el negocio sale del bolsillo.
--  · Si Apple Pay manda el monto en 0, queda pendiente y el SMS de la misma compra lo completa.
-- Se puede correr varias veces.

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
   where a.user_id = uid and not a.archived and a.parent_id is null;
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
