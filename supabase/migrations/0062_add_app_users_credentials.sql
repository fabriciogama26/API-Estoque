-- Adiciona credencial e permissoes de pagina para app_users e libera leitura/edicao para administradores autenticados.

alter table public.app_users
  add column if not exists credential text default 'admin';

alter table public.app_users
  add column if not exists page_permissions text[] default '{}'::text[];

comment on column public.app_users.credential is 'Credencial do usuario (ex.: admin, operador, visitante).';
comment on column public.app_users.page_permissions is 'Lista de rotas/paginas que o usuario pode acessar. Quando vazia, segue o padrao da credencial.';

update public.app_users
set credential = coalesce(nullif(credential, ''), 'admin')
where credential is null or credential = '';

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'app_users admin read'
  ) then
    create policy "app_users admin read" on public.app_users
      for select using (
        exists (
          select 1
          from public.app_users au
          where au.id = auth.uid()
            and coalesce(au.credential, 'admin') = 'admin'
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users'
      and policyname = 'app_users admin update'
  ) then
    create policy "app_users admin update" on public.app_users
      for update using (
        exists (
          select 1
          from public.app_users au
          where au.id = auth.uid()
            and coalesce(au.credential, 'admin') = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.app_users au
          where au.id = auth.uid()
            and coalesce(au.credential, 'admin') = 'admin'
        )
      );
  end if;
end$$;
