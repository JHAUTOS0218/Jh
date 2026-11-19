-- =====================================================================
--  JH FINANZAS · ACTUALIZACIÓN 2
--  Deudas y cuentas por cobrar + colores de la app + nombre.
--  Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
--  (Requiere haber corrido antes 01-fase1.sql). Se puede correr varias veces.
-- =====================================================================

-- ---------- Ajustes: color de la app y categorías de deudas ----------
alter table public.settings add column if not exists theme_color text not null default '#1E5B5A';
alter table public.settings add column if not exists debt_categories text[] not null
  default array['Préstamo','Venta a crédito','Proveedor','Tarjeta o crédito bancario','Arriendo','Otro'];

-- ---------- Deudas: lo que debo (owe) y lo que me deben (owed) ----------
create table if not exists public.debts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  direction    text not null check (direction in ('owe','owed')),  -- owe = yo debo · owed = me deben
  person       text not null,                                     -- a quién le debo / quién me debe
  description  text,
  category     text,
  business_id  uuid not null references public.businesses on delete restrict,
  currency     text not null default 'COP' check (currency in ('COP','USD')),
  total_amount numeric(16,2) not null check (total_amount > 0),
  installment  numeric(16,2),                                     -- cuota
  due_day      int check (due_day between 1 and 31),              -- día de pago de cada mes
  start_date   date not null default current_date,
  note         text,
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists debts_user_idx on public.debts (user_id, direction);

-- ---------- Movimientos ligados a deudas ----------
--  debt_in  = entra plata a una cuenta (me pagan, o recibo un préstamo)  → NO es ingreso
--  debt_out = sale plata de una cuenta (pago una deuda, o presto plata) → NO es gasto
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('expense','income','transfer','debt_in','debt_out'));
alter table public.transactions add column if not exists debt_id uuid references public.debts on delete set null;
alter table public.transactions add column if not exists debt_role text check (debt_role in ('disbursement','payment'));
create index if not exists transactions_debt_idx on public.transactions (debt_id);

-- Regla de guardado actualizada (las deudas no llevan categoría de gasto/ingreso)
create or replace function public.jh_tx_before_save() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  cur  text;
  cur2 text;
  rate numeric;
begin
  new.updated_at := now();

  if new.account_id is not null then
    select currency into cur from accounts where id = new.account_id and user_id = new.user_id;
    if cur is null then raise exception 'Cuenta no encontrada'; end if;
  end if;

  if new.to_account_id is not null then
    select currency into cur2 from accounts where id = new.to_account_id and user_id = new.user_id;
    if cur2 is null then raise exception 'Cuenta destino no encontrada'; end if;
    if cur2 = coalesce(cur, 'COP') then
      new.to_amount := new.amount;
    elsif new.to_amount is null then
      raise exception 'Indica cuánto llegó a la cuenta destino';
    end if;
  end if;

  if new.kind <> 'transfer' then
    new.to_account_id := null;
    new.to_amount := null;
  end if;
  if new.kind not in ('income','expense') then
    new.category_id := null;
  end if;
  if new.kind not in ('debt_in','debt_out') then
    new.debt_id := null;
    new.debt_role := null;
  end if;

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

-- Saldos: ingresos y "entra plata por deuda" suman; lo demás resta
create or replace view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.initial_balance
  + coalesce((select sum(case when t.kind in ('income','debt_in') then t.amount else -t.amount end)
                from transactions t
               where t.account_id = a.id and t.status = 'confirmed'), 0)
  + coalesce((select sum(t.to_amount)
                from transactions t
               where t.to_account_id = a.id and t.kind = 'transfer' and t.status = 'confirmed'), 0)
  as balance
from accounts a;

-- Cuánto se ha pagado de cada deuda
create or replace view public.debt_balances with (security_invoker = true) as
select d.id as debt_id,
       coalesce(sum(t.amount) filter (where t.debt_role = 'payment' and t.status = 'confirmed'), 0) as paid
  from debts d
  left join transactions t on t.debt_id = d.id
 group by d.id;

-- ---------- Seguridad ----------
alter table public.debts enable row level security;
drop policy if exists "solo_dueno" on public.debts;
create policy "solo_dueno" on public.debts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.debts from anon;
revoke all on public.debt_balances from anon;
revoke all on public.account_balances from anon;
