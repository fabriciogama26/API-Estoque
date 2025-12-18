-- Garante que o bucket "imports" exista e aceite XLSX (e CSV para relatórios de erro).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, null, array[
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Políticas básicas para usuários autenticados (ajuste conforme necessário).
do $$
begin
  -- Só tenta criar políticas se a tabela existir (evita erro em instâncias sem storage.policies)
  if to_regclass('storage.policies') is not null then
    if not exists (
      select 1 from storage.policies where name = 'imports_auth_read' and bucket_id = 'imports'
    ) then
      insert into storage.policies (name, definition, action, bucket_id, role)
      values (
        'imports_auth_read',
        'bucket_id = ''imports''',
        'SELECT',
        'imports',
        'authenticated'
      );
    end if;

    if not exists (
      select 1 from storage.policies where name = 'imports_auth_insert' and bucket_id = 'imports'
    ) then
      insert into storage.policies (name, definition, action, bucket_id, role)
      values (
        'imports_auth_insert',
        'bucket_id = ''imports''',
        'INSERT',
        'imports',
        'authenticated'
      );
    end if;
  end if;
end $$;

-- Políticas em storage.objects (modelo atual do Storage).
do $$
begin
  if to_regclass('storage.objects') is not null then
    -- Insert (upload) para autenticados no bucket imports
    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname = 'imports_authenticated_insert'
    ) then
      create policy imports_authenticated_insert
        on storage.objects for insert
        to authenticated
        with check (bucket_id = 'imports');
    end if;

    -- Select (download/list) para autenticados no bucket imports
    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname = 'imports_authenticated_select'
    ) then
      create policy imports_authenticated_select
        on storage.objects for select
        to authenticated
        using (bucket_id = 'imports');
    end if;
  end if;
end $$;
