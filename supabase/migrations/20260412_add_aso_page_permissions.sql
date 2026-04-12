-- Adiciona chaves de permissao por pagina para Pessoas e Controle de ASO.

insert into public.permissions (key, description) values
  ('cadastros.pessoas', 'Pessoas'),
  ('pcsmo.controle_aso', 'Controle de ASO')
on conflict (key) do update
set description = excluded.description;

-- Roles que ja podem alterar Pessoas passam a receber as paginas Pessoas e Controle de ASO.
insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
join public.permissions p_new on p_new.key in ('cadastros.pessoas', 'pcsmo.controle_aso')
where p_old.key = 'pessoas.write'
on conflict do nothing;

-- Backfill de overrides legados para manter o comportamento de acesso por pagina.
insert into public.user_permission_overrides (user_id, permission_key, allowed)
select upo.user_id, mapped.permission_key, upo.allowed
from public.user_permission_overrides upo
cross join (
  values ('cadastros.pessoas'), ('pcsmo.controle_aso')
) as mapped(permission_key)
where upo.permission_key = 'pessoas.write'
on conflict (user_id, permission_key) do update
set allowed = excluded.allowed;

-- Expande chaves de pagina para as permissoes base exigidas pela RLS.
create or replace function public.expand_permission_dependencies(p_permissions text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  with recursive deps(permission_key) as (
    select distinct nullif(btrim(value), '')
    from unnest(coalesce(p_permissions, '{}'::text[])) as value

    union

    select mapping.depends_on
    from deps
    join (
      values
        ('estoque.dashboard', 'estoque.read'),
        ('dashboard_analise_estoque', 'estoque.read'),
        ('estoque.atual', 'estoque.read'),
        ('estoque.entradas', 'estoque.read'),
        ('estoque.saidas', 'estoque.read'),
        ('estoque.saidas', 'pessoas.read'),
        ('estoque.materiais', 'estoque.read'),
        ('estoque.termo', 'estoque.read'),
        ('estoque.termo', 'pessoas.read'),
        ('estoque.relatorio', 'estoque.read'),
        ('estoque.reprocessar', 'estoque.read'),
        ('cadastros.pessoas', 'pessoas.read'),
        ('cadastros.pessoas', 'pessoas.write'),
        ('pcsmo.controle_aso', 'pessoas.read'),
        ('pcsmo.controle_aso', 'pessoas.write'),
        ('acidentes.dashboard', 'acidentes.read')
    ) as mapping(permission_key, depends_on)
      on mapping.permission_key = deps.permission_key
    where nullif(btrim(mapping.depends_on), '') is not null
  )
  select coalesce(
    array(
      select distinct permission_key
      from deps
      where permission_key is not null
      order by permission_key
    ),
    '{}'::text[]
  );
$$;

comment on function public.expand_permission_dependencies(text[]) is
  'Expande permissoes de pagina em permissoes base exigidas pela RLS.';
