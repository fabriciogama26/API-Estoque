-- Ajusta RLS para evitar initplan (auth.* reavaliado por linha) e reduzir policies permissivas duplicadas.

-- app_credentials_catalog: limita policies por role explicitamente.
drop policy if exists "app_credentials_catalog select" on public.app_credentials_catalog;
drop policy if exists "app_credentials_catalog service role" on public.app_credentials_catalog;

create policy "app_credentials_catalog select" on public.app_credentials_catalog
  for select
  to authenticated
  using (true);

create policy "app_credentials_catalog service role" on public.app_credentials_catalog
  for all
  to service_role
  using (true)
  with check (true);

-- app_users: consolida selects/updates e usa (select auth.*) para evitar initplan.
drop policy if exists "app_users service role" on public.app_users;
drop policy if exists "app_users read own" on public.app_users;
drop policy if exists "app_users admin read" on public.app_users;
drop policy if exists "app_users admin update" on public.app_users;
drop policy if exists "app_users authenticated select" on public.app_users;
drop policy if exists "app_users authenticated update" on public.app_users;
drop policy if exists "app_users update own" on public.app_users;

create policy "app_users service role" on public.app_users
  for all
  to service_role
  using (true)
  with check (true);

create policy "app_users authenticated select" on public.app_users
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or public.is_admin_or_master()
  );

create policy "app_users authenticated update" on public.app_users
  for update
  to authenticated
  using (
    public.is_admin_or_master()
    or (select auth.uid()) = id
  )
  with check (
    public.is_admin_or_master()
    or (select auth.uid()) = id
  );

-- app_users_dependentes: mesmas otimizacoes.
drop policy if exists "app_users_dependentes service role" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes read own" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes admin read" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes admin insert" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes admin update" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes admin delete" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes authenticated select" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes authenticated insert" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes authenticated update" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes authenticated delete" on public.app_users_dependentes;
drop policy if exists "app_users_dependentes update own" on public.app_users_dependentes;

create policy "app_users_dependentes service role" on public.app_users_dependentes
  for all
  to service_role
  using (true)
  with check (true);

create policy "app_users_dependentes authenticated select" on public.app_users_dependentes
  for select
  to authenticated
  using (
    public.is_admin_or_master()
    or (select auth.uid()) = auth_user_id
  );

create policy "app_users_dependentes authenticated insert" on public.app_users_dependentes
  for insert
  to authenticated
  with check (public.is_admin_or_master());

create policy "app_users_dependentes authenticated update" on public.app_users_dependentes
  for update
  to authenticated
  using (public.is_admin_or_master())
  with check (public.is_admin_or_master());

create policy "app_users_dependentes authenticated delete" on public.app_users_dependentes
  for delete
  to authenticated
  using (public.is_admin_or_master());

-- RLS enabled sem policies: adiciona politicas minimas de leitura e service_role.
drop policy if exists "acidente_partes_grupo select authenticated" on public.acidente_partes_grupo;
drop policy if exists "acidente_partes_grupo select anon" on public.acidente_partes_grupo;
drop policy if exists "acidente_partes_grupo service role" on public.acidente_partes_grupo;

create policy "acidente_partes_grupo select authenticated" on public.acidente_partes_grupo
  for select
  to authenticated
  using (true);

create policy "acidente_partes_grupo select anon" on public.acidente_partes_grupo
  for select
  to anon
  using (true);

create policy "acidente_partes_grupo service role" on public.acidente_partes_grupo
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "acidente_partes_sub_grupo select authenticated" on public.acidente_partes_sub_grupo;
drop policy if exists "acidente_partes_sub_grupo select anon" on public.acidente_partes_sub_grupo;
drop policy if exists "acidente_partes_sub_grupo service role" on public.acidente_partes_sub_grupo;

create policy "acidente_partes_sub_grupo select authenticated" on public.acidente_partes_sub_grupo
  for select
  to authenticated
  using (true);

create policy "acidente_partes_sub_grupo select anon" on public.acidente_partes_sub_grupo
  for select
  to anon
  using (true);

create policy "acidente_partes_sub_grupo service role" on public.acidente_partes_sub_grupo
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "epi_classe select authenticated" on public.epi_classe;
drop policy if exists "epi_classe select anon" on public.epi_classe;
drop policy if exists "epi_classe service role" on public.epi_classe;

create policy "epi_classe select authenticated" on public.epi_classe
  for select
  to authenticated
  using (true);

create policy "epi_classe select anon" on public.epi_classe
  for select
  to anon
  using (true);

create policy "epi_classe service role" on public.epi_classe
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "planos_users select authenticated" on public.planos_users;
drop policy if exists "planos_users service role" on public.planos_users;

create policy "planos_users select authenticated" on public.planos_users
  for select
  to authenticated
  using (true);

create policy "planos_users service role" on public.planos_users
  for all
  to service_role
  using (true)
  with check (true);
