-- Restringe o bucket "imports" ao prefixo do owner (account_owner_id).

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists imports_authenticated_insert on storage.objects;
    create policy imports_authenticated_insert
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'imports'
        and (
          public.is_master()
          or name like (public.current_account_owner_id()::text || '/%')
        )
      );

    drop policy if exists imports_authenticated_select on storage.objects;
    create policy imports_authenticated_select
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'imports'
        and (
          public.is_master()
          or name like (public.current_account_owner_id()::text || '/%')
        )
      );
  end if;
end $$;

do $$
begin
  if to_regclass('storage.policies') is not null then
    update storage.policies
       set definition = 'bucket_id = ''imports'' and (public.is_master() or name like (public.current_account_owner_id()::text || ''/%''))'
     where bucket_id = 'imports'
       and name in ('imports_auth_read', 'imports_auth_insert');
  end if;
end $$;
