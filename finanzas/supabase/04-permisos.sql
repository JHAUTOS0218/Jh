-- JH FINANZAS · Permisos para el usuario que inicia sesión.
-- Corre esto si la app dice "permission denied for table ...".
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
