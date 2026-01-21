-- Storage: imports bucket and policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, null, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Policies for storage.objects (imports bucket)
create policy imports_authenticated_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imports');

create policy imports_authenticated_select on storage.objects
  for select to authenticated
  using (bucket_id = 'imports');
