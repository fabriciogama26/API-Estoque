-- Garante a funcao current_actor_is_master (usada nas policies internas).

create or replace function public.current_actor_is_master()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with flags as (
    select coalesce((row_to_json(u)::jsonb ->> 'is_master')::boolean, false) as col_master
      from public.app_users u
     where u.id = auth.uid()
  ), roles_flag as (
    select exists (
      select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
       where ur.user_id = auth.uid()
         and lower(r.name) = 'master'
    ) as role_master
  )
  select coalesce(f.col_master, false) or coalesce(r.role_master, false)
    from flags f cross join roles_flag r;
$$;

revoke all on function public.current_actor_is_master() from public;
grant execute on function public.current_actor_is_master() to authenticated;
