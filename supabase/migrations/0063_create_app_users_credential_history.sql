-- Historico de alteracoes de credenciais e paginas.

create table if not exists public.app_users_credential_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  user_username text,
  changed_by uuid,
  changed_by_username text,
  before_credential text,
  after_credential text,
  before_pages text[] default '{}'::text[],
  after_pages text[] default '{}'::text[],
  created_at timestamptz not null default now()
);

comment on table public.app_users_credential_history is 'Historico de alteracoes de credential/page_permissions para app_users.';

alter table public.app_users_credential_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users_credential_history'
      and policyname = 'app_users_cred_hist select authenticated'
  ) then
    create policy "app_users_cred_hist select authenticated" on public.app_users_credential_history
      for select using (auth.role() in ('authenticated', 'service_role'));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users_credential_history'
      and policyname = 'app_users_cred_hist insert authenticated'
  ) then
    create policy "app_users_cred_hist insert authenticated" on public.app_users_credential_history
      for insert
      with check (
        auth.role() in ('authenticated', 'service_role')
        and (auth.role() = 'service_role' or changed_by = auth.uid())
      );
  end if;
end$$;
