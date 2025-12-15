-- Função helper para admins (admin/master) sem recursão em policies.
create or replace function public.is_admin_or_master()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users u
    left join public.app_credentials_catalog c on c.id = u.credential
    where u.id = auth.uid()
      and coalesce(lower(c.id_text), '') in ('admin', 'master')
  );
$$;

comment on function public.is_admin_or_master() is 'Retorna true quando auth.uid() tem credential admin/master (via app_credentials_catalog).';

-- Policies app_users (admins podem ler/atualizar qualquer linha)
drop policy if exists "app_users admin read" on public.app_users;
drop policy if exists "app_users admin update" on public.app_users;

create policy "app_users admin read" on public.app_users
  for select using (public.is_admin_or_master());

create policy "app_users admin update" on public.app_users
  for update using (public.is_admin_or_master())
  with check (public.is_admin_or_master());

-- Policies app_users_dependentes (admins podem gerenciar todos)
drop policy if exists "app_users_dependentes admin read" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes admin insert" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes admin update" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes admin delete" on public.app_users_dependentes;

create policy "app_users_dependentes admin read" on public.app_users_dependentes
  for select using (public.is_admin_or_master());

create policy "app_users_dependentes admin insert" on public.app_users_dependentes
  for insert with check (public.is_admin_or_master());

create policy "app_users_dependentes admin update" on public.app_users_dependentes
  for update using (public.is_admin_or_master())
  with check (public.is_admin_or_master());

create policy "app_users_dependentes admin delete" on public.app_users_dependentes
  for delete using (public.is_admin_or_master());
