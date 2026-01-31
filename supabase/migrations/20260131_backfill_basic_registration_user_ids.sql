-- Backfill de usuario responsavel nas tabelas base quando nao ha match em app_users.

update public.fabricantes f
set created_by_user_id = f.account_owner_id
where (f.created_by_user_id is null or not exists (select 1 from public.app_users u where u.id = f.created_by_user_id))
  and f.account_owner_id is not null;

update public.fabricantes f
set updated_by_user_id = f.account_owner_id
where (f.updated_by_user_id is null or not exists (select 1 from public.app_users u where u.id = f.updated_by_user_id))
  and f.account_owner_id is not null;

update public.cargos c
set created_by_user_id = c.account_owner_id
where (c.created_by_user_id is null or not exists (select 1 from public.app_users u where u.id = c.created_by_user_id))
  and c.account_owner_id is not null;

update public.cargos c
set updated_by_user_id = c.account_owner_id
where (c.updated_by_user_id is null or not exists (select 1 from public.app_users u where u.id = c.updated_by_user_id))
  and c.account_owner_id is not null;

update public.centros_custo cc
set created_by_user_id = cc.account_owner_id
where (cc.created_by_user_id is null or not exists (select 1 from public.app_users u where u.id = cc.created_by_user_id))
  and cc.account_owner_id is not null;

update public.centros_custo cc
set updated_by_user_id = cc.account_owner_id
where (cc.updated_by_user_id is null or not exists (select 1 from public.app_users u where u.id = cc.updated_by_user_id))
  and cc.account_owner_id is not null;

update public.centros_servico cs
set created_by_user_id = cs.account_owner_id
where (cs.created_by_user_id is null or not exists (select 1 from public.app_users u where u.id = cs.created_by_user_id))
  and cs.account_owner_id is not null;

update public.centros_servico cs
set updated_by_user_id = cs.account_owner_id
where (cs.updated_by_user_id is null or not exists (select 1 from public.app_users u where u.id = cs.updated_by_user_id))
  and cs.account_owner_id is not null;

update public.centros_estoque ce
set created_by_user_id = ce.account_owner_id
where (ce.created_by_user_id is null or not exists (select 1 from public.app_users u where u.id = ce.created_by_user_id))
  and ce.account_owner_id is not null;

update public.centros_estoque ce
set updated_by_user_id = ce.account_owner_id
where (ce.updated_by_user_id is null or not exists (select 1 from public.app_users u where u.id = ce.updated_by_user_id))
  and ce.account_owner_id is not null;

update public.setores s
set created_by_user_id = s.account_owner_id
where (s.created_by_user_id is null or not exists (select 1 from public.app_users u where u.id = s.created_by_user_id))
  and s.account_owner_id is not null;

update public.setores s
set updated_by_user_id = s.account_owner_id
where (s.updated_by_user_id is null or not exists (select 1 from public.app_users u where u.id = s.updated_by_user_id))
  and s.account_owner_id is not null;
