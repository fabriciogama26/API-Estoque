-- Cria bucket dedicado para relatórios de erros de importação de desligamento.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, null, array['text/csv'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Políticas: service_role já tem acesso total. Autenticados podem ler/listar se necessário.
do $$
begin
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
end $$;
