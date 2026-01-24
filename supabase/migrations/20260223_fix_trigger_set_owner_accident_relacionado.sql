-- Evita acesso a accident_parts_id quando o trigger roda em outras tabelas.
create or replace function public.set_owner_accident_relacionado()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_owner uuid;
  v_grupo uuid;
  v_subgrupo uuid;
begin
  select a.account_owner_id
    into v_owner
    from public.accidents a
   where a.id = new.accident_id;

  if v_owner is null then
    raise exception 'Acidente sem owner; nao pode vincular.';
  end if;

  if new.account_owner_id is null then
    new.account_owner_id := v_owner;
  elsif new.account_owner_id <> v_owner then
    raise exception 'Owner do vinculo nao confere com o owner do acidente.';
  end if;

  if tg_table_name = 'accident_group_parts' then
    if new.accident_parts_id is not null then
      select grupo, subgrupo into v_grupo, v_subgrupo
        from public.acidente_partes
       where id = new.accident_parts_id;

      if v_grupo is null then
        raise exception 'Parte lesionada invalida.';
      end if;

      if new.accident_parts_group_id is null then
        new.accident_parts_group_id := v_grupo;
      elsif new.accident_parts_group_id <> v_grupo then
        raise exception 'Grupo da parte nao confere.';
      end if;

      if new.accident_parts_subgroup_id is null then
        new.accident_parts_subgroup_id := v_subgrupo;
      elsif v_subgrupo is not null and new.accident_parts_subgroup_id <> v_subgrupo then
        raise exception 'Subgrupo da parte nao confere.';
      end if;
    end if;
  end if;

  return new;
end;
$$;
