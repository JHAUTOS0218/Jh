-- JH FINANZAS · Capital (Inversiones JH), bolsillo de ganancias por negocio y reparto al vender.
-- Se puede correr varias veces.

-- Bolsillo donde se guardan las ganancias de cada negocio (ej. JH Autos → bolsillo "JH Autos")
alter table public.businesses add column if not exists profit_account_id uuid references public.accounts on delete set null;
-- Con qué cuenta/bolsillo se compró cada activo (al venderlo, el costo vuelve ahí)
alter table public.assets add column if not exists funding_account_id uuid references public.accounts on delete set null;
