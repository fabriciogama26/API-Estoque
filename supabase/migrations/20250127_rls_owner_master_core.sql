-- Padroniza RLS com exceção para master e linhas sem owner
-- Tabelas: pessoas (+ historico), acidentes (+ historico), hht_mensal (+ historico), entradas (+ historico)
-- Regra base:
--   SELECT: is_master() OR account_owner_id IS NULL OR account_owner_id = my_owner_id()
--   INSERT/UPDATE: mesma regra; mantém permissões de escrita por domínio

-- Pessoas ----------------------------------------------------
alter table if exists public.pessoas enable row level security;

drop policy if exists pessoas_select_owner on public.pessoas;
create policy pessoas_select_owner
  on public.pessoas
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists pessoas_insert_owner on public.pessoas;
create policy pessoas_insert_owner
  on public.pessoas
  for insert
  to anon, authenticated
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and public.has_permission('pessoas.write'::text)
  );

drop policy if exists pessoas_update_owner on public.pessoas;
create policy pessoas_update_owner
  on public.pessoas
  for update
  to anon, authenticated
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
    and public.has_permission('pessoas.write'::text)
  );

-- Historico de pessoas (somente select/insert)
alter table if exists public.pessoas_historico enable row level security;

drop policy if exists pessoas_historico_select_owner on public.pessoas_historico;
create policy pessoas_historico_select_owner
  on public.pessoas_historico
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists pessoas_historico_insert_owner on public.pessoas_historico;
create policy pessoas_historico_insert_owner
  on public.pessoas_historico
  for insert
  to authenticated
  with check (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

-- Acidentes --------------------------------------------------
alter table if exists public.acidentes enable row level security;

drop policy if exists acidentes_select_owner on public.acidentes;
create policy acidentes_select_owner
  on public.acidentes
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists acidentes_insert_owner on public.acidentes;
create policy acidentes_insert_owner
  on public.acidentes
  for insert
  to authenticated
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and public.has_permission('acidentes.write'::text)
  );

drop policy if exists acidentes_update_owner on public.acidentes;
create policy acidentes_update_owner
  on public.acidentes
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
    and public.has_permission('acidentes.write'::text)
  );

-- Historico de acidentes
alter table if exists public.acidente_historico enable row level security;

drop policy if exists acidente_hist_select_owner on public.acidente_historico;
create policy acidente_hist_select_owner
  on public.acidente_historico
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists acidente_hist_insert_owner on public.acidente_historico;
create policy acidente_hist_insert_owner
  on public.acidente_historico
  for insert
  to authenticated
  with check (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

-- HHT mensal -------------------------------------------------
alter table if exists public.hht_mensal enable row level security;

drop policy if exists hht_mensal_select_owner on public.hht_mensal;
create policy hht_mensal_select_owner
  on public.hht_mensal
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists hht_mensal_insert_owner on public.hht_mensal;
create policy hht_mensal_insert_owner
  on public.hht_mensal
  for insert
  to authenticated
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and public.has_permission('hht.write'::text)
  );

drop policy if exists hht_mensal_update_owner on public.hht_mensal;
create policy hht_mensal_update_owner
  on public.hht_mensal
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
    and public.has_permission('hht.write'::text)
  );

-- Historico hht
alter table if exists public.hht_mensal_hist enable row level security;

drop policy if exists hht_hist_select_owner on public.hht_mensal_hist;
create policy hht_hist_select_owner
  on public.hht_mensal_hist
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists hht_hist_insert_owner on public.hht_mensal_hist;
create policy hht_hist_insert_owner
  on public.hht_mensal_hist
  for insert
  to authenticated
  with check (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

-- Entradas ---------------------------------------------------
alter table if exists public.entradas enable row level security;

drop policy if exists entradas_select_owner on public.entradas;
create policy entradas_select_owner
  on public.entradas
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists entradas_insert_owner on public.entradas;
create policy entradas_insert_owner
  on public.entradas
  for insert
  to authenticated
  with check (
    (
      public.is_master()
      or account_owner_id is null
      or account_owner_id = public.my_owner_id()
    )
    and (
      public.has_permission('entradas.write'::text)
      or public.has_permission('estoque.write'::text)
    )
  );

drop policy if exists entradas_update_owner on public.entradas;
create policy entradas_update_owner
  on public.entradas
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
      public.has_permission('entradas.write'::text)
      or public.has_permission('estoque.write'::text)
    )
  );

-- Historico de entradas
alter table if exists public.entrada_historico enable row level security;

drop policy if exists entrada_hist_select_owner on public.entrada_historico;
create policy entrada_hist_select_owner
  on public.entrada_historico
  for select
  to anon, authenticated
  using (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );

drop policy if exists entrada_hist_insert_owner on public.entrada_historico;
create policy entrada_hist_insert_owner
  on public.entrada_historico
  for insert
  to authenticated
  with check (
    public.is_master()
    or account_owner_id is null
    or account_owner_id = public.my_owner_id()
  );
