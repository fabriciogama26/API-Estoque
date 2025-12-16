-- Adiciona coluna target_auth_user_id para registrar o login (titular ou dependente)
-- e campos auxiliares para relacionar historicos de dependentes ao titular.

alter table if exists public.app_users_credential_history
  add column if not exists target_auth_user_id uuid,
  add column if not exists owner_app_user_id uuid,
  add column if not exists target_dependent_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_users_cred_hist_target_auth_fkey'
      and conrelid = 'public.app_users_credential_history'::regclass
  ) then
    alter table public.app_users_credential_history
      add constraint app_users_cred_hist_target_auth_fkey
        foreign key (target_auth_user_id) references auth.users (id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_users_cred_hist_owner_app_user_fkey'
      and conrelid = 'public.app_users_credential_history'::regclass
  ) then
    alter table public.app_users_credential_history
      add constraint app_users_cred_hist_owner_app_user_fkey
        foreign key (owner_app_user_id) references public.app_users (id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_users_cred_hist_target_dep_fkey'
      and conrelid = 'public.app_users_credential_history'::regclass
  ) then
    alter table public.app_users_credential_history
      add constraint app_users_cred_hist_target_dep_fkey
        foreign key (target_dependent_id) references public.app_users_dependentes (id) on delete cascade;
  end if;
end$$;

-- Preenche target_auth_user_id com user_id quando ainda estiver nulo (titulares).
update public.app_users_credential_history h
set target_auth_user_id = h.user_id
where h.target_auth_user_id is null;

-- Indices para buscas por usuario autenticado e titular.
create index if not exists app_users_cred_hist_target_auth_idx
  on public.app_users_credential_history (target_auth_user_id);

create index if not exists app_users_cred_hist_owner_app_user_idx
  on public.app_users_credential_history (owner_app_user_id);
