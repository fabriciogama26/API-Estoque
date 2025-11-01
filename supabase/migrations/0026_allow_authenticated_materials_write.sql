-- Permite que usuários autenticados insiram e atualizem materiais via RLS,
-- mantendo a política existente para service_role.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'materiais'
      and policyname = 'materiais_insert_authenticated'
  ) then
    create policy materiais_insert_authenticated
      on public.materiais
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'materiais'
      and policyname = 'materiais_update_authenticated'
  ) then
    create policy materiais_update_authenticated
      on public.materiais
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;
