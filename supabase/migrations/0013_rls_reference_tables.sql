-- Configura Row Level Security e politicas de leitura para tabelas de referencia.

-- Habilita RLS nas tabelas de referencia.
alter table if exists public.grupos_material enable row level security;
alter table if exists public.acidente_locais enable row level security;
alter table if exists public.grupos_material_itens enable row level security;

-- Permite leitura (select) para usuarios autenticados.
create policy grupos_material_select_authenticated on public.grupos_material
  for select
  to authenticated
  using (ativo is true);

create policy grupos_material_itens_select_authenticated on public.grupos_material_itens
  for select
  to authenticated
  using (ativo is true);

create policy acidente_locais_select_authenticated on public.acidente_locais
  for select
  to authenticated
  using (ativo is true);

-- Permite leitura para usuarios anonimos (caso necessario para aplicacoes publicas).
create policy grupos_material_select_anon on public.grupos_material
  for select
  to anon
  using (ativo is true);

create policy grupos_material_itens_select_anon on public.grupos_material_itens
  for select
  to anon
  using (ativo is true);

create policy acidente_locais_select_anon on public.acidente_locais
  for select
  to anon
  using (ativo is true);

-- Permite manutencao (insert/update/delete) apenas com chave service_role.
create policy grupos_material_write_service_role on public.grupos_material
  for all
  to service_role
  using (true)
  with check (true);

create policy grupos_material_itens_write_service_role on public.grupos_material_itens
  for all
  to service_role
  using (true)
  with check (true);

create policy acidente_locais_write_service_role on public.acidente_locais
  for all
  to service_role
  using (true)
  with check (true);
