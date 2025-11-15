-- View RPC to fetch all people without PostgREST limit
create or replace function public.rpc_pessoas_completa()
returns setof public.pessoas
language sql
security definer
set search_path = public as $$
  select * from public.pessoas;
$$
grant execute on function public.rpc_pessoas_completa() to authenticated, anon, service_role