begin;

drop policy if exists permissions_block_delete on public.permissions;
drop policy if exists role_permissions_block_delete on public.role_permissions;
drop policy if exists status_saida_block_delete on public.status_saida;
drop policy if exists tipo_execucao_block_delete on public.tipo_execucao;
drop policy if exists user_permission_overrides_block_delete on public.user_permission_overrides;

commit;
