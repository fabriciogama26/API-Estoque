-- Normaliza my_owner_id() para usar current_account_owner_id() com SECURITY DEFINER.

create or replace function public.my_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_account_owner_id();
$$;

revoke all on function public.my_owner_id() from public;
grant execute on function public.my_owner_id() to authenticated;
