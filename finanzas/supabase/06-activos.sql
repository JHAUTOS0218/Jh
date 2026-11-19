-- JH FINANZAS · Activos (carros, motos, oro, inventario) y deudas "aparte".
-- Se puede correr varias veces.
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
