begin;

drop policy if exists user_permission_overrides_block_delete
  on public.user_permission_overrides;

drop policy if exists user_permission_overrides_delete_block
  on public.user_permission_overrides;

create policy user_permission_overrides_block_delete
  on public.user_permission_overrides
  for delete
  to authenticated
  using (false);

commit;
