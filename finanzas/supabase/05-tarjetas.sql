-- JH FINANZAS · Tarjetas de crédito con cupo, sobrecupo, corte y pago.
-- Supabase → SQL Editor → pegar → Run. Se puede correr varias veces.
alter table public.accounts add column if not exists credit_limit numeric(16,2);
alter table public.accounts add column if not exists overlimit_pct numeric(5,2) not null default 0;
alter table public.accounts add column if not exists cut_day int check (cut_day between 1 and 31);
alter table public.accounts add column if not exists pay_day int check (pay_day between 1 and 31);
alter table public.accounts add column if not exists card_fx_rate numeric(12,2);
alter table public.accounts add column if not exists parent_id uuid references public.accounts on delete cascade;
