-- Adiciona chaves de permissao por pagina e mapeia roles existentes.

insert into public.permissions (key, description) values
  ('estoque.atual', 'Estoque Atual'),
  ('estoque.dashboard', 'Dashboard Estoque'),
  ('dashboard_analise_estoque', 'Analise de Estoque'),
  ('acidentes.dashboard', 'Dashboard Acidentes'),
  ('estoque.entradas', 'Entradas'),
  ('estoque.saidas', 'Saidas'),
  ('estoque.materiais', 'Materiais'),
  ('estoque.termo', 'Termo de EPI'),
  ('estoque.relatorio', 'Relatorio de Estoque')
on conflict (key) do nothing;

-- Roles com estoque.read/write recebem as permissoes por pagina de estoque.
insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
join public.permissions p_new on p_new.key in (
  'estoque.atual',
  'estoque.dashboard',
  'dashboard_analise_estoque',
  'estoque.entradas',
  'estoque.saidas',
  'estoque.materiais',
  'estoque.termo',
  'estoque.relatorio'
)
where p_old.key in ('estoque.read', 'estoque.write')
on conflict do nothing;

-- Roles com acidentes.read/write recebem dashboard de acidentes.
insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
join public.permissions p_new on p_new.key = 'acidentes.dashboard'
where p_old.key in ('acidentes.read', 'acidentes.write')
on conflict do nothing;
