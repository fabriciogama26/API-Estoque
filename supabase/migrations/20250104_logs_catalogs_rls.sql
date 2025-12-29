-- Ajusta RLS para logs (master-only leitura) e deixa tabelas de catalogo globais.
-- Requer funcao is_master() (ou current_actor_is_master se existir); aqui usamos is_master().

set check_function_bodies = off;

-- Logs de app/API: leitura apenas master; insercao liberada para autenticados; update/delete bloqueados (ou restritos a master).
alter table if exists public.app_errors enable row level security;
alter table if exists public.app_errors force row level security;

drop policy if exists app_errors_select_master on public.app_errors;
create policy app_errors_select_master on public.app_errors
  for select using (public.is_master());

drop policy if exists app_errors_insert_any on public.app_errors;
create policy app_errors_insert_any on public.app_errors
  for insert with check (true);

drop policy if exists app_errors_update_block on public.app_errors;
create policy app_errors_update_block on public.app_errors
  for update using (false) with check (false);

drop policy if exists app_errors_delete_block on public.app_errors;
create policy app_errors_delete_block on public.app_errors
  for delete using (false);

alter table if exists public.api_errors enable row level security;
alter table if exists public.api_errors force row level security;

drop policy if exists api_errors_select_master on public.api_errors;
create policy api_errors_select_master on public.api_errors
  for select using (public.is_master());

drop policy if exists api_errors_insert_any on public.api_errors;
create policy api_errors_insert_any on public.api_errors
  for insert with check (true);

drop policy if exists api_errors_update_block on public.api_errors;
create policy api_errors_update_block on public.api_errors
  for update using (false) with check (false);

drop policy if exists api_errors_delete_block on public.api_errors;
create policy api_errors_delete_block on public.api_errors
  for delete using (false);

-- Tabelas de catalogo usadas por todos (ex.: listas de acidentes/partes/etc) ficam globais:
-- nao adicionar account_owner_id nem RLS. Caso ja tenha habilitado, avalie desabilitar RLS ou criar policy permissiva.
