-- JH FINANZAS · Registro de lo que envía el Atajo (para revisar errores) y menú de cuentas más corto.
-- Se puede correr varias veces.

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
     where a.user_id = uid and not a.archived and a.parent_id is null;
  end if;
  return coalesce(out, array[]::text[]);
end $$;
revoke all on function public.jh_ingest_lists(text, text) from public;
grant execute on function public.jh_ingest_lists(text, text) to anon, authenticated;
