-- =====================================================================
--  JH FINANZAS · ACTUALIZACIÓN 3 · PAGOS FIJOS MENSUALES
--  Arriendo, servicios, suscripciones, nómina… con recordatorio y
--  botón "Marcar pagado" que crea el movimiento.
--  Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
--  (Requiere 01 y 02). Se puede correr varias veces.
-- =====================================================================

create table if not exists public.recurring_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,                         -- ej. "Arriendo oficina"
  kind        text not null default 'expense' check (kind in ('expense','income')),
  amount      numeric(16,2) not null check (amount > 0),  -- valor de referencia (se puede cambiar al pagar)
  business_id uuid not null references public.businesses on delete restrict,
  category_id uuid references public.categories on delete set null,
  account_id  uuid references public.accounts on delete set null,  -- cuenta con la que normalmente se paga
  day_of_month int not null default 1 check (day_of_month between 1 and 31),
  note        text,
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists recurring_user_idx on public.recurring_payments (user_id);

-- Cada pago queda ligado a su pago fijo (así se sabe si ya se pagó este mes)
alter table public.transactions add column if not exists recurring_id uuid references public.recurring_payments on delete set null;
create index if not exists transactions_recurring_idx on public.transactions (recurring_id, date);

alter table public.recurring_payments enable row level security;
drop policy if exists "solo_dueno" on public.recurring_payments;
create policy "solo_dueno" on public.recurring_payments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.recurring_payments from anon;
