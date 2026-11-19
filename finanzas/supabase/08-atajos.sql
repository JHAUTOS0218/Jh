-- JH FINANZAS · Recibir pagos de Apple Pay y SMS desde la app Atajos del iPhone.
-- Los movimientos llegan como "pendientes" (Por clasificar) y no afectan saldos hasta clasificarlos.
create extension if not exists pgcrypto;

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
