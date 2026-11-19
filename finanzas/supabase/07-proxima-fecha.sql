-- JH FINANZAS · Fecha exacta del próximo pago/cobro de una deuda (ej. cuotas del 15 y el 30)
alter table public.debts add column if not exists next_due date;
