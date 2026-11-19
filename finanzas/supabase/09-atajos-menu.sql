-- JH FINANZAS · Atajo con menú: elegir cuenta y negocio al pagar; la categoría se asigna sola.
-- Se puede correr varias veces.

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
