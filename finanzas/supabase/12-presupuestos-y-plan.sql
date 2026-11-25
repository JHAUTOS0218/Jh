-- JH FINANZAS · Presupuestos mensuales, costo de vida y plan de la plata.
-- Se puede correr varias veces.

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
