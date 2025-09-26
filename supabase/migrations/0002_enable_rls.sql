-- supabase/migrations/0002_enable_rls.sql
-- Ativa RLS e define politicas padrao.

alter table public.app_users enable row level security;
alter table public.materiais enable row level security;
alter table public.pessoas enable row level security;
alter table public.precos_historico enable row level security;
alter table public.entradas enable row level security;
alter table public.saidas enable row level security;

create policy "app_users service role" on public.app_users
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "app_users read own" on public.app_users
  for select using (
    auth.role() = 'authenticated' and
    auth.uid() = auth_user_id
  );

create policy "materiais select" on public.materiais
  for select using (auth.role() in ('authenticated', 'service_role'));

create policy "materiais modify" on public.materiais
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "pessoas select" on public.pessoas
  for select using (auth.role() in ('authenticated', 'service_role'));

create policy "pessoas modify" on public.pessoas
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "precos select" on public.precos_historico
  for select using (auth.role() in ('authenticated', 'service_role'));

create policy "precos modify" on public.precos_historico
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "entradas select" on public.entradas
  for select using (auth.role() in ('authenticated', 'service_role'));

create policy "entradas modify" on public.entradas
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "saidas select" on public.saidas
  for select using (auth.role() in ('authenticated', 'service_role'));

create policy "saidas modify" on public.saidas
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

