-- Restringe SELECT em app_users: master vê tudo; demais veem apenas o próprio owner/dependentes.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'app_users select by owner'
  ) then
    create policy "app_users select by owner" on public.app_users
      for select to authenticated
      using (
        public.is_role_master() -- master vê todos
        or (
          parent_user_id = public.my_owner_id() -- dependentes do meu owner
          or id = public.my_owner_id()          -- o próprio owner (eu)
        )
      );
  end if;
end
$$;
