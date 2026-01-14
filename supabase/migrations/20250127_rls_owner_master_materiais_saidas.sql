-- Padroniza RLS de materiais e saídas para aceitar master, owner e linhas sem owner.
-- SELECT: is_master() OU account_owner_id IS NULL OU account_owner_id = my_owner_id()
-- INSERT/UPDATE: mesmo critério, mantendo permissões de escrita já existentes.

-- Materiais
alter table if exists public.materiais enable row level security;

-- SELECT
drop policy if exists materiais_select_owner on public.materiais;
create policy materiais_select_owner
  on public.materiais
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

-- INSERT
drop policy if exists materiais_insert_owner on public.materiais;
create policy materiais_insert_owner
  on public.materiais
  for insert
  to authenticated
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
    )
  );

-- UPDATE
drop policy if exists materiais_update_owner on public.materiais;
create policy materiais_update_owner
  on public.materiais
  for update
  to authenticated
  using (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
    )
  )
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and (
      public.is_master()
      or public.has_permission('estoque.write'::text)
    )
  );

-- Saídas
alter table if exists public.saidas enable row level security;

-- SELECT
drop policy if exists saidas_select_owner on public.saidas;
create policy saidas_select_owner
  on public.saidas
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

-- INSERT (mantém exigência de permissão de escrita)
drop policy if exists saidas_insert_owner on public.saidas;
create policy saidas_insert_owner
  on public.saidas
  for insert
  to authenticated
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and (
      public.has_permission('saidas.write'::text)
      or public.has_permission('estoque.write'::text)
    )
  );

-- Historico de saídas (select/insert)
alter table if exists public.saidas_historico enable row level security;

drop policy if exists saidas_hist_select_owner on public.saidas_historico;
create policy saidas_hist_select_owner
  on public.saidas_historico
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists saidas_hist_insert_owner on public.saidas_historico;
create policy saidas_hist_insert_owner
  on public.saidas_historico
  for insert
  to authenticated
  with check (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

-- Historico de materiais (preços)
alter table if exists public.material_price_history enable row level security;

drop policy if exists mat_price_hist_select_owner on public.material_price_history;
create policy mat_price_hist_select_owner
  on public.material_price_history
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists mat_price_hist_insert_owner on public.material_price_history;
create policy mat_price_hist_insert_owner
  on public.material_price_history
  for insert
  to authenticated
  with check (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

-- Catálogos usados no preflight/hash: leitura liberada para todos
alter table if exists public.material_grupo_cor enable row level security;
drop policy if exists material_grupo_cor_select_all on public.material_grupo_cor;
create policy material_grupo_cor_select_all
  on public.material_grupo_cor
  for select
  to public
  using (true);

drop policy if exists material_grupo_cor_insert_owner on public.material_grupo_cor;
create policy material_grupo_cor_insert_owner
  on public.material_grupo_cor
  for insert
  to authenticated
  with check (
    public.is_master()
    or true  -- tabelas de catálogo não possuem account_owner_id; libera para autenticados
  );

drop policy if exists material_grupo_cor_update_owner on public.material_grupo_cor;
create policy material_grupo_cor_update_owner
  on public.material_grupo_cor
  for update
  to authenticated
  using (
    public.is_master()
    or true
  )
  with check (
    public.is_master()
    or true
  );

drop policy if exists material_grupo_cor_delete_auth on public.material_grupo_cor;
create policy material_grupo_cor_delete_auth
  on public.material_grupo_cor
  for delete
  to authenticated
  using (true);

alter table if exists public.material_grupo_caracteristica_epi enable row level security;
drop policy if exists material_grupo_carac_select_all on public.material_grupo_caracteristica_epi;
create policy material_grupo_carac_select_all
  on public.material_grupo_caracteristica_epi
  for select
  to public
  using (true);

drop policy if exists material_grupo_carac_insert_owner on public.material_grupo_caracteristica_epi;
create policy material_grupo_carac_insert_owner
  on public.material_grupo_caracteristica_epi
  for insert
  to authenticated
  with check (
    public.is_master()
    or true  -- catálogo sem account_owner_id
  );

drop policy if exists material_grupo_carac_update_owner on public.material_grupo_caracteristica_epi;
create policy material_grupo_carac_update_owner
  on public.material_grupo_caracteristica_epi
  for update
  to authenticated
  using (
    public.is_master()
    or true
  )
  with check (
    public.is_master()
    or true
  );

drop policy if exists material_grupo_carac_delete_auth on public.material_grupo_caracteristica_epi;
create policy material_grupo_carac_delete_auth
  on public.material_grupo_caracteristica_epi
  for delete
  to authenticated
  using (true);
-- UPDATE (mantém exigência de permissão de escrita)
drop policy if exists saidas_update_owner on public.saidas;
create policy saidas_update_owner
  on public.saidas
  for update
  to authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  )
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and (
      public.has_permission('saidas.write'::text)
      or public.has_permission('estoque.write'::text)
    )
  );
