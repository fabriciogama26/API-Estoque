-- Catálogo de credenciais permitidas para titulares ou dependentes.
-- Estrutura resiliente a mudancas manuais (ex.: id uuid + id_text).
create table if not exists public.app_credentials_catalog (
  id uuid primary key default gen_random_uuid(),
  id_text text,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garante colunas/constraints caso a tabela ja exista.
alter table public.app_credentials_catalog
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists id_text text,
  alter column label set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.app_credentials_catalog
set id_text = coalesce(nullif(id_text, ''), lower(regexp_replace(label, '\\s+', '_', 'g')))
where id_text is null or id_text = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_credentials_catalog_id_text_key'
      and conrelid = 'public.app_credentials_catalog'::regclass
  ) then
    alter table public.app_credentials_catalog
      add constraint app_credentials_catalog_id_text_key unique (id_text);
  end if;
end$$;

comment on table public.app_credentials_catalog is 'Lista de credenciais validas para app_users e dependentes.';

insert into public.app_credentials_catalog (id_text, label, description)
values
  ('master', 'Master', 'Acesso total'),
  ('admin', 'Administrador', 'Administracao completa'),
  ('operador', 'Operador', 'Operacao diaria'),
  ('estagiario', 'Estagiario', 'Acesso reduzido'),
  ('visitante', 'Visitante', 'Somente leitura basica')
on conflict (id) do nothing;

-- Cria tabela de usuarios dependentes vinculados a app_users (titular).
create table if not exists public.app_users_dependentes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  owner_app_user_id uuid not null,
  username text,
  display_name text,
  email text,
  ativo boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_dependentes_auth_user_id_key unique (auth_user_id),
  constraint app_users_dependentes_auth_user_id_fkey foreign key (auth_user_id) references auth.users (id) on delete cascade,
  constraint app_users_dependentes_owner_app_user_id_fkey foreign key (owner_app_user_id) references public.app_users (id) on delete cascade
);

-- Ajusta colunas para cenarios onde a tabela ja existia sem as novas colunas.
alter table public.app_users_dependentes
  add column if not exists credential text,
  add column if not exists page_permissions text[] default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_users_dependentes_credential_fkey'
      and conrelid = 'public.app_users_dependentes'::regclass
  ) then
    alter table public.app_users_dependentes
      add constraint app_users_dependentes_credential_fkey foreign key (credential) references public.app_credentials_catalog(id_text);
  end if;
end$$;

comment on table public.app_users_dependentes is 'Mapeia usuarios dependentes para um titular em app_users.';
comment on column public.app_users_dependentes.auth_user_id is 'UUID do usuario dependente (auth.users).';
comment on column public.app_users_dependentes.owner_app_user_id is 'Titular em app_users que fornece credencial/permissoes.';
comment on column public.app_users_dependentes.credential is 'Credencial do dependente (se ausente, herda do titular).';
comment on column public.app_users_dependentes.page_permissions is 'Permissoes especificas do dependente (sobrescrevem o padrao da credencial/titular).';
comment on column public.app_users_dependentes.ativo is 'Se falso, bloqueia o dependente mesmo que o titular esteja ativo.';

create index if not exists app_users_dependentes_owner_idx
  on public.app_users_dependentes (owner_app_user_id);

-- Remove policies que referenciam credential para permitir alter type.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_users_dependentes'
      and policyname in (
        'app_users_dependentes admin read',
        'app_users_dependentes admin insert',
        'app_users_dependentes admin update',
        'app_users_dependentes admin delete'
      )
  ) then
    drop policy if exists "app_users_dependentes admin read" on public.app_users_dependentes;
    drop policy if exists "app_users_dependentes admin insert" on public.app_users_dependentes;
    drop policy if exists "app_users_dependentes admin update" on public.app_users_dependentes;
    drop policy if exists "app_users_dependentes admin delete" on public.app_users_dependentes;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_users'
      and policyname in (
        'app_users admin read',
        'app_users admin update'
      )
  ) then
    drop policy if exists "app_users admin read" on public.app_users;
    drop policy if exists "app_users admin update" on public.app_users;
  end if;
end$$;

-- Ajusta credential em app_users para usar catalogo textual (id_text).
alter table public.app_users
  alter column credential type text using credential::text,
  alter column credential set default 'admin';

update public.app_users
set credential = coalesce(nullif(credential, ''), 'admin');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_users_credential_fkey'
      and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users
      add constraint app_users_credential_fkey foreign key (credential) references public.app_credentials_catalog(id_text);
  end if;
end$$;

-- Recria policies que dependem de credential (caso tenham sido removidas).
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

create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_credentials_catalog_set_updated_at on public.app_credentials_catalog;
create trigger app_credentials_catalog_set_updated_at
  before update on public.app_credentials_catalog
  for each row
  execute function public.set_current_timestamp_updated_at();

drop trigger if exists app_users_dependentes_set_updated_at on public.app_users_dependentes;
create trigger app_users_dependentes_set_updated_at
  before update on public.app_users_dependentes
  for each row
  execute function public.set_current_timestamp_updated_at();

alter table public.app_users_dependentes enable row level security;
alter table public.app_credentials_catalog enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users_dependentes'
      and policyname = 'app_users_dependentes service role'
  ) then
    create policy "app_users_dependentes service role" on public.app_users_dependentes
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users_dependentes'
      and policyname = 'app_users_dependentes read own'
  ) then
    create policy "app_users_dependentes read own" on public.app_users_dependentes
      for select using (
        auth.role() = 'authenticated'
        and auth.uid() = auth_user_id
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_credentials_catalog'
      and policyname = 'app_credentials_catalog select'
  ) then
    create policy "app_credentials_catalog select" on public.app_credentials_catalog
      for select using (auth.role() in ('authenticated', 'service_role'));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_credentials_catalog'
      and policyname = 'app_credentials_catalog service role'
  ) then
    create policy "app_credentials_catalog service role" on public.app_credentials_catalog
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users_dependentes'
      and policyname = 'app_users_dependentes admin read'
  ) then
    create policy "app_users_dependentes admin read" on public.app_users_dependentes
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
      and tablename = 'app_users_dependentes'
      and policyname = 'app_users_dependentes admin insert'
  ) then
    create policy "app_users_dependentes admin insert" on public.app_users_dependentes
      for insert with check (
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
      and tablename = 'app_users_dependentes'
      and policyname = 'app_users_dependentes admin update'
  ) then
    create policy "app_users_dependentes admin update" on public.app_users_dependentes
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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_users_dependentes'
      and policyname = 'app_users_dependentes admin delete'
  ) then
    create policy "app_users_dependentes admin delete" on public.app_users_dependentes
      for delete using (
        exists (
          select 1
          from public.app_users au
          where au.id = auth.uid()
            and coalesce(au.credential, 'admin') = 'admin'
        )
      );
  end if;
end$$;
