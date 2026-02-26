-- Permissao para reprocessar previsao de estoque/gasto.

insert into public.permissions (key, description)
values ('estoque.reprocessar', 'Reprocessar previsao de gasto/estoque')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'estoque.reprocessar'
where lower(r.name) in ('master', 'admin', 'owner')
on conflict do nothing;
