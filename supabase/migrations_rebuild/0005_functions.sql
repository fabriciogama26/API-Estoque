CREATE FUNCTION public._ensure_item(nome_input text, tabela text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $_$
declare
  nome_limpo text := trim(coalesce(nome_input, ''));
  registro_id uuid;
  ordem_proxima smallint;
  v_owner uuid := public.my_owner_id();
  v_is_master boolean := public.is_master();
  v_table text := lower(tabela);
  v_has_owner boolean := v_table = any (array['service_centers','departments','job_roles','cost_centers']);
begin
  if nome_limpo = '' then
    raise exception 'Valor nao pode ser vazio.';
  end if;

  if v_table not in ('service_centers','departments','job_roles','cost_centers','execution_types') then
    raise exception 'Tabela invalida.';
  end if;

  if not (v_is_master or public.has_permission('pessoas.write'::text)) then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  if v_has_owner and v_owner is null and not v_is_master then
    raise exception 'owner nao encontrado' using errcode = '42501';
  end if;

  if v_has_owner then
    execute format('select id from %I where lower(name) = lower($1) and account_owner_id = $2 limit 1', v_table)
      into registro_id
      using nome_limpo, v_owner;
  else
    execute format('select id from %I where lower(name) = lower($1) limit 1', v_table)
      into registro_id
      using nome_limpo;
  end if;

  if registro_id is not null then
    return registro_id;
  end if;

  execute format('select coalesce(max(sort_order), 0) + 1 from %I', v_table)
    into ordem_proxima;

  if v_has_owner then
    execute format('insert into %I (name, sort_order, is_active, account_owner_id) values ($1, $2, true, $3) returning id', v_table)
      into registro_id
      using nome_limpo, ordem_proxima, v_owner;
  else
    execute format('insert into %I (name, sort_order, is_active) values ($1, $2, true) returning id', v_table)
      into registro_id
      using nome_limpo, ordem_proxima;
  end if;

  return registro_id;
end;
$_$;

CREATE FUNCTION public.atualizar_hashes_material(p_material_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
BEGIN
  UPDATE public.materials
  SET
    base_hash = public.material_hash_base(p_material_id),
    full_hash = public.material_hash_completo(p_material_id)
  WHERE id = p_material_id;
END;
$$;

CREATE FUNCTION public.bump_perm_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid;
begin
  v_user_id := coalesce(new.edited_by_user_id, old.edited_by_user_id);
  if v_user_id is null then
    return coalesce(new, old);
  end if;
  update public.app_users
    set perm_version = coalesce(perm_version, 1) + 1,
        updated_at = now()
  where id = v_user_id;
  return coalesce(new, old);
end;
$$;

CREATE FUNCTION public.current_account_owner_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_owner uuid;
begin
  perform set_config('row_security', 'off', true);

  select d.owner_user_id
    into v_owner
    from public.app_user_dependents d
   where d.auth_user_id = auth.uid()
   limit 1;

  if v_owner is not null then
    return v_owner;
  end if;

  select coalesce(u.parent_user_id, u.id)
    into v_owner
    from public.app_users u
   where u.id = auth.uid()
   limit 1;

  return v_owner;
end;
$$;

CREATE FUNCTION public.current_actor_is_master() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  with flags as (
    select coalesce((row_to_json(u)::jsonb ->> 'is_master')::boolean, false) as col_master
      from public.app_users u
     where u.id = auth.uid()
  ), roles_flag as (
    select exists (
      select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
       where ur.edited_by_user_id = auth.uid()
         and lower(r.name) = 'master'
    ) as role_master
  )
  select coalesce(f.col_master, false) or coalesce(r.role_master, false)
    from flags f cross join roles_flag r;
$$;

CREATE FUNCTION public.current_credential_level() RETURNS smallint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(c.level, 0)
  from public.app_users u
  left join public.app_credentials_catalog c on c.id = u.credential
  where u.id = (select auth.uid());
$$;

CREATE FUNCTION public.debug_material_owner(p_material_id uuid) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
select jsonb_build_object(
  'material_id', m.id,
  'material_owner', m.account_owner_id,
  'my_owner', public.my_owner_id(),
  'matches', (m.account_owner_id = public.my_owner_id())
)
from public.materials m
where m.id = p_material_id;
$$;

CREATE FUNCTION public.debug_whoami() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
select jsonb_build_object(
  'uid', auth.uid(),
  'owner_id', public.my_owner_id(),
  'can_write', public.has_permission('estoque.write'::text)
);
$$;

CREATE FUNCTION public.debug_whoami_invoker() RETURNS jsonb
    LANGUAGE sql
    AS $$
select jsonb_build_object(
  'uid', auth.uid(),
  'owner_id', public.my_owner_id(),
  'can_write', public.has_permission('estoque.write'::text)
);
$$;

CREATE FUNCTION public.evitar_duplicidade_material() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE
  v_ca_norm text;
  v_hash_base text;
  v_hash_completo text;
  v_owner uuid;
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  v_ca_norm := NULLIF(fn_normalize_any(NEW.ca_code), '');
  v_owner := COALESCE(NEW.account_owner_id, public.my_owner_id());

  IF v_ca_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.materials m
    WHERE m.id <> NEW.id
      AND NULLIF(fn_normalize_any(m.ca_code), '') = v_ca_norm
      AND (
        (v_owner IS NULL AND m.account_owner_id IS NULL)
        OR m.account_owner_id = v_owner
      )
  ) THEN
    RAISE EXCEPTION 'Ja existe material cadastrado com este C.A.';
  END IF;

  v_hash_base := public.material_hash_base(NEW.id);
  NEW.base_hash := v_hash_base;

  IF TG_OP = 'UPDATE' THEN
    v_hash_completo := public.material_hash_completo(NEW.id);
    NEW.full_hash := v_hash_completo;

    IF v_ca_norm IS NULL AND EXISTS (
      SELECT 1 FROM public.materials m
      WHERE public.material_hash_base(m.id) = v_hash_base
        AND public.material_hash_completo(m.id) = v_hash_completo
    ) THEN
      RAISE EXCEPTION 'Material duplicado com base igual e CA vazio.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.materials m
      WHERE public.material_hash_completo(m.id) = v_hash_completo
    ) THEN
      RAISE EXCEPTION 'Material duplicado com mesmas cores/caracteristicas e C.A.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.evitar_duplicidade_material(material_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  novo_hash text;
  duplicado_id uuid;
BEGIN
  SELECT hash_unico
  INTO novo_hash
  FROM public.unique_materials_view
  WHERE id = material_id;

  IF novo_hash IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO duplicado_id
  FROM public.unique_materials_view
  WHERE hash_unico = novo_hash
    AND id <> material_id
  LIMIT 1;

  IF duplicado_id IS NOT NULL THEN
    RAISE EXCEPTION 'Material duplicado com mesmas cores e características.';
  END IF;
END;
$$;

CREATE FUNCTION public.evitar_duplicidade_material_trigger() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  material_uuid uuid := COALESCE(NEW.id, OLD.id);
BEGIN
  IF material_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  PERFORM public.evitar_duplicidade_material(material_uuid);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE FUNCTION public.evitar_duplicidade_material_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_ca_norm text;
  v_hash_base text;
  v_hash_completo text;
  v_owner uuid;
BEGIN
  v_ca_norm := NULLIF(fn_normalize_any(NEW.ca_code), '');
  v_owner := COALESCE(NEW.account_owner_id, public.my_owner_id());

  IF v_ca_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.materials m
    WHERE m.id <> NEW.id
      AND NULLIF(fn_normalize_any(m.ca_code), '') = v_ca_norm
      AND (
        (v_owner IS NULL AND m.account_owner_id IS NULL)
        OR m.account_owner_id = v_owner
      )
  ) THEN
    RAISE EXCEPTION 'Ja existe material cadastrado com este C.A.';
  END IF;

  v_hash_base := public.material_hash_base(NEW.id);
  v_hash_completo := public.material_hash_completo(NEW.id);

  NEW.base_hash := v_hash_base;
  NEW.full_hash := v_hash_completo;

  IF v_ca_norm IS NULL AND EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id <> NEW.id
      AND public.material_hash_base(m.id) = v_hash_base
      AND public.material_hash_completo(m.id) = v_hash_completo
  ) THEN
    RAISE EXCEPTION 'Material duplicado com base igual e CA vazio.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id <> NEW.id
      AND public.material_hash_completo(m.id) = v_hash_completo
  ) THEN
    RAISE EXCEPTION 'Material duplicado com mesmas cores/caracteristicas e C.A.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.evitar_duplicidade_pessoa() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_mat_norm text;
  v_owner uuid;
BEGIN
  v_mat_norm := NULLIF(fn_normalize_any(NEW.registration_number), '');
  v_owner := NEW.account_owner_id;

  IF v_mat_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.people p
    WHERE (v_owner IS NULL OR p.account_owner_id IS NULL OR p.account_owner_id = v_owner)
      AND (TG_OP <> 'UPDATE' OR p.id <> NEW.id)
      AND NULLIF(fn_normalize_any(p.registration_number), '') = v_mat_norm
  ) THEN
    RAISE EXCEPTION 'Ja existe pessoa com esta registration_number.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION public.fn_normalize_any(p_val anyelement) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT lower(trim(coalesce(p_val::text, '')));
$$;

CREATE FUNCTION public.fn_normalize_text(p_val text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT lower(trim(coalesce(p_val, '')));
$$;

CREATE FUNCTION public.has_permission(p_key text, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with override as (
    select allowed
    from public.user_permission_overrides o
    where o.edited_by_user_id = coalesce(p_user_id, auth.uid())
      and o.permission_key = p_key
    limit 1
  ),
  role_perm as (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.edited_by_user_id = coalesce(p_user_id, auth.uid())
      and p.key = p_key
    limit 1
  )
  select case
           when exists(select 1 from override where allowed = false) then false
           when exists(select 1 from override where allowed = true) then true
           when exists(select 1 from role_perm) then true
           else false
         end;
$$;

CREATE FUNCTION public.has_role(p_role text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_owner uuid;
  v_ok boolean;
begin
  perform set_config('row_security', 'off', true);
  v_owner := public.current_account_owner_id();

  select exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.edited_by_user_id = auth.uid()
       and ur.scope_parent_user_id = v_owner
       and lower(r.name) = lower(p_role)
  ) into v_ok;

  return coalesce(v_ok, false);
end;
$$;

CREATE FUNCTION public.hht_mensal_apply_calcs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  base numeric(16,4);
  descontos numeric(16,4);
  calculado numeric(16,4);
  v_status_default uuid;
begin
  v_status_default := nullif(current_setting('app.status_hht_default', true), '')::uuid;

  if new.month_ref is not null then
    new.month_ref = date_trunc('month', new.month_ref)::date;
  end if;

  new.mode = coalesce(nullif(lower(btrim(new.mode)), ''), 'simples');
  new.hht_status_id = coalesce(new.hht_status_id, v_status_default);

  new.people_count = coalesce(new.people_count, 0);
  new.base_month_hours = coalesce(new.base_month_hours, 0);
  new.scale_factor = coalesce(new.scale_factor, 1);

  new.leave_hours = coalesce(new.leave_hours, 0);
  new.vacation_hours = coalesce(new.vacation_hours, 0);
  new.training_hours = coalesce(new.training_hours, 0);
  new.other_discount_hours = coalesce(new.other_discount_hours, 0);
  new.overtime_hours = coalesce(new.overtime_hours, 0);

  if new.mode = 'simples' then
    new.scale_factor = 1;
    new.leave_hours = 0;
    new.vacation_hours = 0;
    new.training_hours = 0;
    new.other_discount_hours = 0;
    new.overtime_hours = 0;

    calculado = (new.people_count::numeric * new.base_month_hours);
  else
    base = (new.people_count::numeric * new.base_month_hours * new.scale_factor);
    descontos = (new.leave_hours + new.vacation_hours + new.training_hours + new.other_discount_hours);
    calculado = base - descontos + new.overtime_hours;
  end if;

  new.calculated_hht = round(calculado::numeric, 2);

  if new.mode = 'manual' then
    if new.reported_hht is null then
      raise exception 'Informe o HHT para mode manual.';
    end if;
    new.final_hht = round(new.reported_hht::numeric, 2);
  else
    new.reported_hht = null;
    new.final_hht = new.calculated_hht;
  end if;

  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, now());
    new.created_by = coalesce(new.created_by, auth.uid());
  end if;

  new.updated_at = now();
  new.updated_by = coalesce(new.updated_by, auth.uid());

  return new;
end;
$$;

CREATE FUNCTION public.hht_monthly_delete(p_id uuid, p_motivo text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_registro record;
  v_centro_nome text;
  v_mes_ref date;
  v_tem_acidente boolean;
  v_status_cancelado uuid;
begin
  select id, month_ref, service_center_id, hht_status_id
    into v_registro
    from public.hht_monthly
   where id = p_id;

  if not found then
    raise exception 'Registro nao encontrado.';
  end if;

  v_status_cancelado := nullif(current_setting('app.status_hht_cancelado', true), '')::uuid;
  if v_status_cancelado is null then
    select id into v_status_cancelado from public.hht_statuses where lower(status) = 'cancelado' limit 1;
  end if;

  if v_status_cancelado is not null and v_registro.hht_status_id = v_status_cancelado then
    raise exception 'Registro ja cancelado.';
  end if;

  select name into v_centro_nome from public.service_centers where id = v_registro.service_center_id;
  v_mes_ref := v_registro.month_ref;

  select exists(
    select 1
      from public.accidents a
     where date_trunc('month', a.accident_date) = v_mes_ref
       and lower(btrim(coalesce(a.service_center, ''))) = lower(btrim(coalesce(v_centro_nome, '')))
  ) into v_tem_acidente;

  if coalesce(v_tem_acidente, false) then
    raise exception 'Nao e possivel cancelar: ha acidentes cadastrados para este centro e mes.';
  end if;

  perform set_config('app.hht_motivo', coalesce(trim(both from p_motivo), ''), true);
  update public.hht_monthly
     set hht_status_id = coalesce(v_status_cancelado, hht_status_id)
   where id = p_id;
end;
$$;

CREATE FUNCTION public.hht_mensal_log_update_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  old_base jsonb;
  new_base jsonb;
  reason text;
begin
  reason = nullif(current_setting('app.hht_motivo', true), '');

  if tg_op = 'UPDATE' then
    old_base = to_jsonb(old) - 'updated_at' - 'updated_by';
    new_base = to_jsonb(new) - 'updated_at' - 'updated_by';
    if old_base is distinct from new_base then
      insert into public.hht_monthly_history (hht_monthly_id, action, changed_by, before, after, reason)
      values (new.id, 'UPDATE', auth.uid(), to_jsonb(old), to_jsonb(new), reason);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.hht_monthly_history (hht_monthly_id, action, changed_by, before, after, reason)
    values (old.id, 'DELETE', auth.uid(), to_jsonb(old), null, reason);
    return old;
  end if;

  return null;
end;
$$;

CREATE FUNCTION public.hht_mensal_prevent_inactivation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_centro_nome text;
  v_mes_ref date;
  v_tem_acidente boolean;
  v_status_cancelado uuid;
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_setting('app.bypass_hht_guard', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_status_cancelado := nullif(current_setting('app.status_hht_cancelado', true), '')::uuid;
  if v_status_cancelado is null then
    select id into v_status_cancelado from public.hht_statuses where lower(status) = 'cancelado' limit 1;
  end if;

  if tg_op = 'DELETE' then
    select name into v_centro_nome from public.service_centers where id = old.service_center_id;
    v_mes_ref := old.month_ref;

    select exists(
      select 1
        from public.accidents a
       where date_trunc('month', a.accident_date) = v_mes_ref
         and lower(btrim(coalesce(a.service_center, ''))) = lower(btrim(coalesce(v_centro_nome, '')))
    ) into v_tem_acidente;

    if coalesce(v_tem_acidente, false) then
      raise exception 'Nao e possivel cancelar/excluir: ha acidentes cadastrados para este centro e mes.';
    end if;
    return old;
  end if;

  if v_status_cancelado is not null
     and new.hht_status_id = v_status_cancelado
     and (old.hht_status_id is distinct from v_status_cancelado) then
    select name into v_centro_nome from public.service_centers where id = new.service_center_id;
    v_mes_ref := new.month_ref;

    select exists(
      select 1
        from public.accidents a
       where date_trunc('month', a.accident_date) = v_mes_ref
         and lower(btrim(coalesce(a.service_center, ''))) = lower(btrim(coalesce(v_centro_nome, '')))
    ) into v_tem_acidente;

    if coalesce(v_tem_acidente, false) then
      raise exception 'Nao e possivel cancelar: ha acidentes cadastrados para este centro e mes.';
    end if;
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$ select public.has_role('admin') or public.has_role('master'); $$;

CREATE FUNCTION public.is_admin_or_master() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.app_users u
    left join public.app_credentials_catalog c on c.id = u.credential
    where u.id = auth.uid()
      and coalesce(lower(c.code), '') in ('admin', 'master')
  );
$$;

CREATE FUNCTION public.is_master() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$ select public.has_role('master'); $$;

CREATE FUNCTION public.is_owner(p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(
    select 1 from public.app_users where id = p_user_id and parent_user_id is null
  );
$$;

CREATE FUNCTION public.is_role_master(p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.edited_by_user_id = coalesce(p_user_id, auth.uid())
      and lower(r.name) = 'master'
  );
$$;

CREATE FUNCTION public.mask_email(p_email text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  select case
           when p_email is null or length(btrim(p_email)) = 0 then null
           else regexp_replace(p_email, '(^.).*(@.+$)', '\1***\2')
         end;
$_$;

CREATE FUNCTION public.material_create_full(p_material jsonb, p_cores_ids uuid[] DEFAULT NULL::uuid[], p_caracteristicas_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.my_owner_id();
  v_id uuid;
begin
  if not (public.is_master() or public.has_permission('estoque.write'::text)) then
    raise exception 'Sem permissao para criar material.';
  end if;

  insert into public.materials (
    name,
    manufacturer,
    "shelf_life_days",
    ca_code,
    "unit_price",
    "min_stock",
    is_active,
    description,
    "material_group_id",
    "shoe_size_id",
    "clothing_size_id",
    "specific_size",
    "created_by_user_id",
    created_at,
    "updated_by_user_id",
    "updated_at",
    account_owner_id
  )
  values (
    nullif(p_material->>'name', '')::uuid,
    nullif(p_material->>'manufacturer', '')::uuid,
    nullif(p_material->>'shelf_life_days', '')::int,
    coalesce(p_material->>'ca_code', ''),
    coalesce(nullif(p_material->>'unit_price', '')::numeric, 0),
    coalesce(nullif(p_material->>'min_stock', '')::int, 0),
    coalesce(nullif(p_material->>'is_active', '')::boolean, true),
    coalesce(p_material->>'description', ''),
    nullif(p_material->>'material_group_id', '')::uuid,
    nullif(p_material->>'shoe_size_id', '')::uuid,
    nullif(p_material->>'clothing_size_id', '')::uuid,
    coalesce(p_material->>'specific_size', ''),
    nullif(p_material->>'created_by_user_id', '')::uuid,
    coalesce(nullif(p_material->>'created_at', '')::timestamptz, now()),
    nullif(p_material->>'updated_by_user_id', '')::uuid,
    coalesce(nullif(p_material->>'updated_at', '')::timestamptz, now()),
    v_owner
  )
  returning materials.id into v_id;

  if p_cores_ids is not null then
    insert into public.material_colors (material_id, color_id, account_owner_id)
    select v_id, cor_id, v_owner
    from unnest(p_cores_ids) as cor_id
    where cor_id is not null;
  end if;

  if p_caracteristicas_ids is not null then
    insert into public.material_ppe_characteristics (material_id, ppe_characteristic_id, account_owner_id)
    select v_id, carac_id, v_owner
    from unnest(p_caracteristicas_ids) as carac_id
    where carac_id is not null;
  end if;

  return query select v_id;
end;
$$;

CREATE FUNCTION public.material_hash_base(p_material_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
WITH cores_agg AS (
  SELECT
    mgc.material_id,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT fn_normalize_text(c.name) ORDER BY fn_normalize_text(c.name)), ';') AS cores_string
  FROM public.material_colors mgc
  LEFT JOIN public.colors c ON c.id::text = mgc.color_id::text
  WHERE mgc.material_id = p_material_id
  GROUP BY mgc.material_id
)
SELECT md5(
  fn_normalize_text(
    CONCAT_WS('|',
      COALESCE(m.manufacturer::text, ''),
      COALESCE(m."material_group_id"::text, ''),
      COALESCE(public.material_resolve_item_nome(m.id), ''),
      COALESCE(public.material_resolve_numero(m.id), ''),
      COALESCE(cores_agg.cores_string, '')
    )
  )
)
FROM public.materials m
LEFT JOIN cores_agg ON cores_agg.material_id = m.id
WHERE m.id = p_material_id;
$$;

CREATE FUNCTION public.material_hash_completo(p_material_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
WITH cores_agg AS (
  SELECT
    mgc.material_id,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT fn_normalize_text(c.name) ORDER BY fn_normalize_text(c.name)), ';') AS cores_string
  FROM public.material_colors mgc
  LEFT JOIN public.colors c ON c.id::text = mgc.color_id::text
  WHERE mgc.material_id = p_material_id
  GROUP BY mgc.material_id
),
caracteristicas_agg AS (
  SELECT
    mgce.material_id,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT fn_normalize_text(ce.characteristic) ORDER BY fn_normalize_text(ce.characteristic)), ';') AS caracteristicas_string
  FROM public.material_ppe_characteristics mgce
  LEFT JOIN public.ppe_characteristics ce ON ce.id::text = mgce.ppe_characteristic_id::text
  WHERE mgce.material_id = p_material_id
  GROUP BY mgce.material_id
)
SELECT md5(
  fn_normalize_text(
    CONCAT_WS('|',
      COALESCE(m.manufacturer::text, ''),
      COALESCE(m."material_group_id"::text, ''),
      COALESCE(public.material_resolve_item_nome(m.id), ''),
      COALESCE(public.material_resolve_numero(m.id), ''),
      COALESCE(NULLIF(m.ca_code, ''), ''),
      COALESCE(cores_agg.cores_string, ''),
      COALESCE(caracteristicas_agg.caracteristicas_string, '')
    )
  )
)
FROM public.materials m
LEFT JOIN cores_agg ON cores_agg.material_id = m.id
LEFT JOIN caracteristicas_agg ON caracteristicas_agg.material_id = m.id
WHERE m.id = p_material_id;
$$;

CREATE FUNCTION public.material_preflight_check(p_grupo uuid, p_nome uuid, p_fabricante uuid, p_numero_especifico text, p_numero_calcado uuid, p_numero_vestimenta uuid, p_ca text, p_account_owner_id uuid, p_cores_ids uuid[] DEFAULT NULL::uuid[], p_caracteristicas_ids uuid[] DEFAULT NULL::uuid[], p_material_id uuid DEFAULT NULL::uuid) RETURNS TABLE(ca_conflict boolean, base_conflict_empty boolean, base_match_ca_diff boolean, base_match_ids uuid[])
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE
  v_ca_norm text := NULLIF(fn_normalize_any(p_ca), '');
  v_numero text := NULLIF(fn_normalize_any(p_numero_especifico), '');
  v_numero_sentinel constant text := '__sem_numero__';
  v_numero_norm text;
  v_cores_input text;
  v_caracteristicas_input text;
BEGIN
  IF v_numero IS NULL THEN
    v_numero := NULLIF(fn_normalize_any(p_numero_calcado), '');
  END IF;

  IF v_numero IS NULL THEN
    v_numero := NULLIF(fn_normalize_any(p_numero_vestimenta), '');
  END IF;

  v_numero_norm := COALESCE(v_numero, v_numero_sentinel);

  SELECT COALESCE(
           NULLIF(
             array_to_string(
               ARRAY(
                 SELECT x::text
                 FROM unnest(COALESCE(p_cores_ids, ARRAY[]::uuid[])) AS x
                 WHERE x IS NOT NULL
                 ORDER BY 1
               ),
               ';'
             ),
             ''
           ),
           '__sem_cor__'
         )
  INTO v_cores_input;

  SELECT COALESCE(
           NULLIF(
             array_to_string(
               ARRAY(
                 SELECT x::text
                 FROM unnest(COALESCE(p_caracteristicas_ids, ARRAY[]::uuid[])) AS x
                 WHERE x IS NOT NULL
                 ORDER BY 1
               ),
               ';'
             ),
             ''
           ),
           '__sem_carac__'
         )
  INTO v_caracteristicas_input;

  WITH base AS (
    SELECT
      m.id,
      fn_normalize_any(m.manufacturer) AS fab,
      fn_normalize_any(m."material_group_id") AS grp,
      fn_normalize_any(m.name) AS name,
      COALESCE(
        NULLIF(fn_normalize_any(public.material_resolve_numero(m.id)), ''),
        v_numero_sentinel
      ) AS num,
      COALESCE(NULLIF(fn_normalize_any(m.ca_code), ''), '') AS ca_norm,
      COALESCE(
        NULLIF(
          (
            SELECT array_to_string(
              ARRAY(
                SELECT mgc.color_id::text
                FROM public.material_colors mgc
                WHERE mgc.material_id = m.id
                ORDER BY mgc.color_id::text
              ),
              ';'
            )
          ),
          ''
        ),
        '__sem_cor__'
      ) AS cores_ids,
      COALESCE(
        NULLIF(
          (
            SELECT array_to_string(
              ARRAY(
                SELECT mgce.ppe_characteristic_id::text
                FROM public.material_ppe_characteristics mgce
                WHERE mgce.material_id = m.id
                ORDER BY mgce.ppe_characteristic_id::text
              ),
              ';'
            )
          ),
          ''
        ),
        '__sem_carac__'
      ) AS carac_ids
    FROM public.materials m
    WHERE
      (p_material_id IS NULL OR m.id <> p_material_id)
      AND (
        m.account_owner_id IS NULL
        OR m.account_owner_id = COALESCE(p_account_owner_id, public.my_owner_id())
      )
  )
  SELECT
    EXISTS (
      SELECT 1
      FROM base b
      WHERE v_ca_norm IS NOT NULL
        AND b.ca_norm = v_ca_norm
    ),
    EXISTS (
      SELECT 1
      FROM base b
      WHERE b.fab = fn_normalize_any(p_fabricante)
        AND b.grp = fn_normalize_any(p_grupo)
        AND b.name = fn_normalize_any(p_nome)
        AND b.num = v_numero_norm
        AND b.cores_ids = v_cores_input
        AND b.carac_ids = v_caracteristicas_input
        AND (
          v_ca_norm IS NULL OR v_ca_norm = '' OR b.ca_norm = ''
        )
    ),
    EXISTS (
      SELECT 1
      FROM base b
      WHERE b.fab = fn_normalize_any(p_fabricante)
        AND b.grp = fn_normalize_any(p_grupo)
        AND b.name = fn_normalize_any(p_nome)
        AND b.num = v_numero_norm
        AND b.cores_ids = v_cores_input
        AND b.carac_ids = v_caracteristicas_input
        AND v_ca_norm IS NOT NULL
        AND b.ca_norm <> ''
        AND b.ca_norm <> v_ca_norm
    ),
    (
      SELECT ARRAY_AGG(b.id)
      FROM base b
      WHERE b.fab = fn_normalize_any(p_fabricante)
        AND b.grp = fn_normalize_any(p_grupo)
        AND b.name = fn_normalize_any(p_nome)
        AND b.num = v_numero_norm
        AND b.cores_ids = v_cores_input
        AND b.carac_ids = v_caracteristicas_input
        AND v_ca_norm IS NOT NULL
        AND b.ca_norm <> ''
        AND b.ca_norm <> v_ca_norm
    )
  INTO
    ca_conflict,
    base_conflict_empty,
    base_match_ca_diff,
    base_match_ids;

  RETURN NEXT;
END;
$$;

CREATE FUNCTION public.material_resolve_item_nome(p_material_id uuid) RETURNS text
    LANGUAGE sql STABLE
    AS $$
SELECT COALESCE(
  gmi.name,
  m.name::text,
  ''
)
FROM public.materials m
LEFT JOIN public.material_group_items gmi
  ON gmi.id = m.name
WHERE m.id = p_material_id;
$$;

CREATE FUNCTION public.material_resolve_numero(p_material_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
SELECT COALESCE(
  NULLIF(m."specific_size"::text, ''),
  NULLIF(m."shoe_size_id"::text, ''),
  NULLIF(m."clothing_size_id"::text, ''),
  m."specific_size"::text,
  m."shoe_size_id"::text,
  m."clothing_size_id"::text,
  ''
)
FROM public.materials m
WHERE m.id = p_material_id;
$$;

CREATE FUNCTION public.material_update_full(p_material_id uuid, p_material jsonb, p_cores_ids uuid[] DEFAULT NULL::uuid[], p_caracteristicas_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.my_owner_id();
  v_material_owner uuid;
  v_owner_effective uuid;
begin
  if not (public.is_master() or public.has_permission('estoque.write'::text)) then
    raise exception 'Sem permissao para atualizar material.';
  end if;

  select m.account_owner_id
    into v_material_owner
    from public.materials m
   where m.id = p_material_id;

  if v_material_owner is null and v_owner is null then
    raise exception 'Material sem owner; nao pode atualizar.';
  end if;

  if not public.is_master() and v_material_owner is distinct from v_owner then
    raise exception 'Material fora do escopo do owner.';
  end if;

  v_owner_effective := coalesce(v_material_owner, v_owner);

  update public.materials as m
     set name = nullif(p_material->>'name', '')::uuid,
         manufacturer = nullif(p_material->>'manufacturer', '')::uuid,
         "shelf_life_days" = nullif(p_material->>'shelf_life_days', '')::int,
         ca_code = coalesce(p_material->>'ca_code', ''),
         "unit_price" = coalesce(nullif(p_material->>'unit_price', '')::numeric, 0),
         "min_stock" = coalesce(nullif(p_material->>'min_stock', '')::int, 0),
         is_active = coalesce(nullif(p_material->>'is_active', '')::boolean, true),
         description = coalesce(p_material->>'description', ''),
         "material_group_id" = nullif(p_material->>'material_group_id', '')::uuid,
         "shoe_size_id" = nullif(p_material->>'shoe_size_id', '')::uuid,
         "clothing_size_id" = nullif(p_material->>'clothing_size_id', '')::uuid,
         "specific_size" = coalesce(p_material->>'specific_size', ''),
         "updated_by_user_id" = nullif(p_material->>'updated_by_user_id', '')::uuid,
         "updated_at" = coalesce(nullif(p_material->>'updated_at', '')::timestamptz, now())
   where m.id = p_material_id;

  if not found then
    raise exception 'Material nao encontrado.';
  end if;

  if p_cores_ids is not null then
    delete from public.material_colors
     where material_id = p_material_id;

    insert into public.material_colors (material_id, color_id, account_owner_id)
    select p_material_id, cor_id, v_owner_effective
    from unnest(p_cores_ids) as cor_id
    where cor_id is not null;
  end if;

  if p_caracteristicas_ids is not null then
    delete from public.material_ppe_characteristics
     where material_id = p_material_id;

    insert into public.material_ppe_characteristics (material_id, ppe_characteristic_id, account_owner_id)
    select p_material_id, carac_id, v_owner_effective
    from unnest(p_caracteristicas_ids) as carac_id
    where carac_id is not null;
  end if;

  return query select p_material_id;
end;
$$;

CREATE FUNCTION public.my_owner_id(p_user_id uuid DEFAULT auth.uid()) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
           when u.parent_user_id is null then u.id
           else u.parent_user_id
         end
  from public.app_users u
  where u.id = coalesce(p_user_id, auth.uid());
$$;

CREATE FUNCTION public.my_owner_id_v2(p_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner uuid;
begin
  select coalesce(u.parent_user_id, u.id)
    into v_owner
  from public.app_users u
  where u.id = coalesce(p_user_id, auth.uid());

  if v_owner is null then
    raise exception 'user not registered in app_users';
  end if;

  return v_owner;
end;
$$;

CREATE FUNCTION public.pessoas_force_inativo_on_demissao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new."termination_date" is null or trim(coalesce(new."termination_date"::text, '')) = '' then
    new.is_active := true;
  else
    new.is_active := false;
  end if;
  return new;
end;
$$;

CREATE FUNCTION public.people_preflight_check(p_owner uuid, p_nome text, p_matricula text, p_pessoa_id uuid DEFAULT NULL::uuid) RETURNS TABLE(matricula_conflict boolean, nome_conflict boolean, conflict_ids uuid[])
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_nome_norm text := NULLIF(fn_normalize_any(p_nome), '');
  v_mat_norm text := NULLIF(fn_normalize_any(p_matricula), '');
BEGIN
  WITH base AS (
    SELECT
      id,
      NULLIF(fn_normalize_any(name), '') AS nome_norm,
      NULLIF(fn_normalize_any(registration_number), '') AS mat_norm
    FROM public.people p
    WHERE
      (p_owner IS NULL OR p.account_owner_id IS NULL OR p.account_owner_id = p_owner)
      AND (p_pessoa_id IS NULL OR p.id <> p_pessoa_id)
  )
  SELECT
    EXISTS (
      SELECT 1 FROM base b
      WHERE v_mat_norm IS NOT NULL
        AND b.mat_norm = v_mat_norm
    ),
    EXISTS (
      SELECT 1 FROM base b
      WHERE v_nome_norm IS NOT NULL
        AND b.nome_norm = v_nome_norm
        AND b.mat_norm IS NOT NULL
        AND (v_mat_norm IS NULL OR b.mat_norm <> v_mat_norm)
    ),
    (
      SELECT ARRAY_AGG(b.id)
      FROM base b
      WHERE v_nome_norm IS NOT NULL
        AND b.nome_norm = v_nome_norm
        AND b.mat_norm IS NOT NULL
        AND (v_mat_norm IS NULL OR b.mat_norm <> v_mat_norm)
    )
  INTO matricula_conflict, nome_conflict, conflict_ids;

  RETURN NEXT;
END;
$$;

CREATE FUNCTION public.recalcular_trocas(p_pessoa_id uuid, p_material_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_status_cancelado_id uuid := 'e57d3be9-8fb9-4f4a-a63d-da4d3139a5ef'; -- cancelado
begin
  if p_pessoa_id is null or p_material_id is null then
    return;
  end if;

  with ordered as (
    select
      s.id,
      row_number() over (
        order by s."delivered_at" asc nulls last,
                 s."exchange_at" asc nulls last,
                 s."created_at" asc nulls last,
                 s.id asc
      ) as rn,
      lag(s.id) over (
        order by s."delivered_at" asc nulls last,
                 s."exchange_at" asc nulls last,
                 s."created_at" asc nulls last,
                 s.id asc
      ) as prev_id
    from public.stock_outputs s
    where s."person_id" = p_pessoa_id
      and s."material_id" = p_material_id
      and (v_owner is null or s.account_owner_id = v_owner)
      and coalesce(s.status, '00000000-0000-0000-0000-000000000000') <> v_status_cancelado_id
  )
  update public.stock_outputs s
     set "is_exchange" = (o.rn > 1),
         "exchange_from_output_id" = case when o.rn > 1 then o.prev_id else null end,
         "exchange_sequence" = case when o.rn > 1 then o.rn - 1 else 0 end
  from ordered o
  where s.id = o.id
    and (
      s."is_exchange" is distinct from (o.rn > 1)
      or s."exchange_from_output_id" is distinct from (case when o.rn > 1 then o.prev_id else null end)
      or s."exchange_sequence" is distinct from (case when o.rn > 1 then o.rn - 1 else 0 end)
    );
end;
$$;

CREATE FUNCTION public.request_password_reset(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
begin
  raise exception 'Reset de senha deve ser chamado via Edge Function request-password-reset.' using errcode = '0A000';
end;
$$;

CREATE FUNCTION public.resolve_user_permissions(p_user_id uuid DEFAULT auth.uid()) RETURNS text[]
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with is_master as (
    select exists(
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.edited_by_user_id = coalesce(p_user_id, auth.uid())
        and lower(r.name) = 'master'
    ) as master_flag
  ),
  role_perms as (
    select distinct p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.edited_by_user_id = coalesce(p_user_id, auth.uid())
  ),
  overrides as (
    select permission_key, allowed
    from public.user_permission_overrides
    where edited_by_user_id = coalesce(p_user_id, auth.uid())
  ),
  merged as (
    select key
    from role_perms
    where key not in (
      select permission_key from overrides where allowed = false
    )
    union
    select permission_key
    from overrides
    where allowed = true
  )
  select
    case
      when (select master_flag from is_master) then
        array(select key from public.permissions)
      else
        coalesce(array(select key from merged), '{}')
    end;
$$;

CREATE FUNCTION public.revalidar_material_hash() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  material_uuid uuid := COALESCE(NEW.material_id, OLD.material_id);
BEGIN
  IF material_uuid IS NOT NULL THEN
    PERFORM public.evitar_duplicidade_material(material_uuid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE FUNCTION public.revalidar_material_hash(material_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  tmp_record record;
BEGIN
  PERFORM 1 FROM public.materials WHERE id = material_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  PERFORM public.evitar_duplicidade_material() FROM (SELECT * FROM public.materials WHERE id = material_id) AS tmp_record;
END;
$$;

CREATE FUNCTION public.rpc_accidents_create_full(p_matricula text, p_nome text, p_cargo text, p_data timestamp with time zone, p_dias_perdidos numeric, p_dias_debitados numeric, p_tipo text, p_agente text, p_cid text, p_centro_servico text, p_local text, p_cat text, p_observacao text, p_partes_lesionadas text[], p_lesoes text[], p_data_esocial timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sesmt boolean DEFAULT false, p_data_sesmt timestamp with time zone DEFAULT NULL::timestamp with time zone, p_hht numeric DEFAULT NULL::numeric, p_registrado_por text DEFAULT NULL::text) RETURNS SETOF public.accidents
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('acidentes.write'::text);
  v_registrado text := coalesce(nullif(trim(p_registrado_por), ''), auth.uid()::text);
  v_id uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := auth.uid();
  end if;

  insert into public.accidents (
    registration_number,
    name,
    job_role,
    accident_date,
    "lost_days",
    "debited_days",
    accident_type,
    accident_agent,
    icd_code,
    service_center,
    location_name,
    cat_number,
    notes,
    injured_body_parts,
    injuries,
    esocial_date,
    sesmt_involved,
    sesmt_date,
    hht_value,
    "created_by_username",
    account_owner_id
  ) values (
    p_matricula,
    p_nome,
    p_cargo,
    p_data,
    coalesce(p_dias_perdidos, 0),
    coalesce(p_dias_debitados, 0),
    p_tipo,
    p_agente,
    p_cid,
    p_centro_servico,
    p_local,
    p_cat,
    p_observacao,
    coalesce(p_partes_lesionadas, '{}'::text[]),
    coalesce(p_lesoes, '{}'::text[]),
    p_data_esocial,
    coalesce(p_sesmt, false),
    p_data_sesmt,
    p_hht,
    v_registrado,
    v_owner
  ) returning id into v_id;

  return query
    select *
      from public.accidents a
     where a.id = v_id
       and (v_is_master or a.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.rpc_accident_filters() RETURNS TABLE(centros_servico text[], tipos text[], injuries text[], partes text[], agentes text[], cargos text[])
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with centros as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(a.service_center), ''), 'Nao informado') as label
        from public.accidents a
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  tipos as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(valor), ''), 'Nao informado') as label
        from public.accidents a
        cross join lateral regexp_split_to_table(
          coalesce(nullif(a.accident_type, ''), 'Nao informado'),
          E'\\s*[;,]\\s*'
        ) as valor
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  agentes as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(valor), ''), 'Nao informado') as label
        from public.accidents a
        cross join lateral regexp_split_to_table(
          coalesce(nullif(a.accident_agent, ''), 'Nao informado'),
          E'\\s*[;,]\\s*'
        ) as valor
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  cargos as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(a.job_role), ''), 'Nao informado') as label
        from public.accidents a
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  injuries as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(valor), ''), 'Nao informado') as label
        from public.accidents a
        cross join lateral unnest(
          case
            when coalesce(array_length(a.injuries, 1), 0) > 0 then a.injuries
            else array[coalesce(nullif(trim(to_jsonb(a)->>'lesao'), ''), 'Nao informado')]
          end
        ) as valor
      ) dados
      where label <> ''
      order by label
    ) as valores
  ),
  partes as (
    select array(
      select distinct label
      from (
        select coalesce(nullif(trim(valor), ''), 'Nao informado') as label
        from public.accidents a
        cross join lateral unnest(
          case
            when coalesce(array_length(a.injured_body_parts, 1), 0) > 0 then a.injured_body_parts
            else array[coalesce(nullif(trim(to_jsonb(a)->>'parteLesionada'), ''), 'Nao informado')]
          end
        ) as valor
      ) dados
      where label <> ''
      order by label
    ) as valores
  )
  select
    coalesce((select valores from centros), array[]::text[]) as centros_servico,
    coalesce((select valores from tipos), array[]::text[]) as tipos,
    coalesce((select valores from injuries), array[]::text[]) as injuries,
    coalesce((select valores from partes), array[]::text[]) as partes,
    coalesce((select valores from agentes), array[]::text[]) as agentes,
    coalesce((select valores from public.job_roles), array[]::text[]) as cargos;
$$;

CREATE FUNCTION public.rpc_accidents_update_full(p_id uuid, p_matricula text, p_nome text, p_cargo text, p_data timestamp with time zone, p_dias_perdidos numeric, p_dias_debitados numeric, p_tipo text, p_agente text, p_cid text, p_centro_servico text, p_local text, p_cat text, p_observacao text, p_partes_lesionadas text[], p_lesoes text[], p_data_esocial timestamp with time zone DEFAULT NULL::timestamp with time zone, p_sesmt boolean DEFAULT false, p_data_sesmt timestamp with time zone DEFAULT NULL::timestamp with time zone, p_hht numeric DEFAULT NULL::numeric, p_atualizado_por text DEFAULT NULL::text, p_campos_alterados jsonb DEFAULT '[]'::jsonb) RETURNS SETOF public.accidents
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('acidentes.write'::text);
  v_atualizado text := coalesce(nullif(trim(p_atualizado_por), ''), auth.uid()::text);
  v_row_owner uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.accidents
   where id = p_id;

  if v_row_owner is null then
    raise exception 'acidente_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.accidents
     set registration_number = p_matricula,
         name = p_nome,
         job_role = p_cargo,
         accident_date = p_data,
         "lost_days" = coalesce(p_dias_perdidos, 0),
         "debited_days" = coalesce(p_dias_debitados, 0),
         accident_type = p_tipo,
         accident_agent = p_agente,
         icd_code = p_cid,
         service_center = p_centro_servico,
         location_name = p_local,
         cat_number = p_cat,
         notes = p_observacao,
         injured_body_parts = coalesce(p_partes_lesionadas, '{}'::text[]),
         injuries = coalesce(p_lesoes, '{}'::text[]),
         esocial_date = p_data_esocial,
         sesmt_involved = coalesce(p_sesmt, false),
         sesmt_date = p_data_sesmt,
         hht_value = p_hht,
         "updated_by_username" = v_atualizado,
         "updated_at" = now()
   where id = p_id;

  if p_campos_alterados is not null
     and jsonb_typeof(p_campos_alterados) = 'array'
     and jsonb_array_length(p_campos_alterados) > 0 then
    insert into public.accident_history (
      acidente_id,
      edited_at,
      responsible_user,
      changed_fields,
      account_owner_id
    ) values (
      p_id,
      now(),
      v_atualizado,
      p_campos_alterados,
      v_row_owner
    );
  end if;

  return query
    select *
      from public.accidents a
     where a.id = p_id
       and (v_is_master or a.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.rpc_admin_grant_permission_override(target_user_id uuid, overrides jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_owner uuid;
  v_is_master boolean;
  v_target_owner uuid;
  v_item jsonb;
  v_key text;
  v_allowed boolean;
begin
  if target_user_id is null then
    raise exception 'target_user_id obrigatorio';
  end if;

  if not public.is_admin() then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  select coalesce(parent_user_id, id)
    into v_target_owner
    from public.app_users
   where id = target_user_id;

  if not found then
    raise exception 'destino nao encontrado' using errcode = '23503';
  end if;

  if not v_is_master and v_target_owner <> v_owner then
    raise exception 'escopo diferente' using errcode = '42501';
  end if;

  delete from public.user_permission_overrides where edited_by_user_id = target_user_id;

  if overrides is null then
    return;
  end if;

  for v_item in select * from jsonb_array_elements(overrides)
  loop
    v_key := (v_item ->> 'permission_key');
    v_allowed := (v_item ->> 'allowed')::boolean;
    if v_key is not null then
      insert into public.user_permission_overrides (edited_by_user_id, permission_key, allowed)
      values (target_user_id, v_key, v_allowed);
    end if;
  end loop;
end;
$$;

CREATE FUNCTION public.rpc_admin_set_user_role(target_user_id uuid, role_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_owner uuid;
  v_is_master boolean;
  v_target_owner uuid;
begin
  if target_user_id is null then
    raise exception 'target_user_id obrigatorio';
  end if;

  if not public.is_admin() then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  select coalesce(parent_user_id, id)
    into v_target_owner
    from public.app_users
   where id = target_user_id;

  if not found then
    raise exception 'destino nao encontrado' using errcode = '23503';
  end if;

  if not v_is_master and v_target_owner <> v_owner then
    raise exception 'escopo diferente' using errcode = '42501';
  end if;

  delete from public.user_roles
   where edited_by_user_id = target_user_id
     and scope_parent_user_id = v_target_owner;

  if role_id is not null then
    insert into public.user_roles (edited_by_user_id, role_id, scope_parent_user_id)
    values (target_user_id, role_id, v_target_owner);
  end if;
end;
$$;

CREATE FUNCTION public.rpc_admin_set_user_status(target_user_id uuid, status boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_owner uuid;
  v_is_master boolean;
  v_target_owner uuid;
begin
  if target_user_id is null then
    raise exception 'target_user_id obrigatorio';
  end if;

  if not public.is_admin() then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  select coalesce(parent_user_id, id)
    into v_target_owner
    from public.app_users
   where id = target_user_id;

  if not found then
    raise exception 'destino nao encontrado' using errcode = '23503';
  end if;

  if not v_is_master and v_target_owner <> v_owner then
    raise exception 'escopo diferente' using errcode = '42501';
  end if;

  update public.app_users
     set is_active = status,
         updated_at = now()
   where id = target_user_id;
end;
$$;

CREATE FUNCTION public.rpc_admin_write_credential_history(target_user_id uuid, owner_user_id uuid, dependent_id uuid, user_username text, changed_by uuid, changed_by_username text, before_pages jsonb, after_pages jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_owner uuid;
  v_is_master boolean;
  v_target_owner uuid;
begin
  if target_user_id is null then
    raise exception 'target_user_id obrigatorio';
  end if;

  if not public.is_admin() then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  select coalesce(parent_user_id, id)
    into v_target_owner
    from public.app_users
   where id = target_user_id;

  if not found then
    raise exception 'destino nao encontrado' using errcode = '23503';
  end if;

  if not v_is_master and v_target_owner <> v_owner then
    raise exception 'escopo diferente' using errcode = '42501';
  end if;

  insert into public.app_user_credential_history (
    edited_by_user_id,
    target_auth_user_id,
    owner_user_id,
    target_dependent_id,
    user_username,
    changed_by,
    changed_by_username,
    action,
    before_credential,
    after_credential,
    before_pages,
    after_pages
  ) values (
    owner_user_id,
    target_user_id,
    v_target_owner,
    dependent_id,
    user_username,
    changed_by,
    changed_by_username,
    'role_update',
    null,
    null,
    before_pages,
    after_pages
  );
end;
$$;

CREATE FUNCTION public.rpc_admin_write_credential_history(target_user_id uuid, owner_user_id uuid, dependent_id uuid, user_username text, changed_by uuid, changed_by_username text, before_pages jsonb, after_pages jsonb, p_action text DEFAULT 'role_update'::text, p_before_credential text DEFAULT NULL::text, p_after_credential text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_owner uuid;
  v_is_master boolean;
  v_target_owner uuid;
  v_action text := nullif(trim(coalesce(p_action, 'role_update')), '');
begin
  if target_user_id is null then
    raise exception 'target_user_id obrigatorio';
  end if;

  if not public.is_admin() then
    raise exception 'permissao negada' using errcode = '42501';
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  select coalesce(parent_user_id, id)
    into v_target_owner
    from public.app_users
   where id = target_user_id;

  if not found then
    raise exception 'destino nao encontrado' using errcode = '23503';
  end if;

  if not v_is_master and v_target_owner <> v_owner then
    raise exception 'escopo diferente' using errcode = '42501';
  end if;

  insert into public.app_user_credential_history (
    edited_by_user_id,
    target_auth_user_id,
    owner_user_id,
    target_dependent_id,
    user_username,
    changed_by,
    changed_by_username,
    action,
    before_credential,
    after_credential,
    before_pages,
    after_pages
  ) values (
    owner_user_id,
    target_user_id,
    v_target_owner,
    dependent_id,
    user_username,
    changed_by,
    changed_by_username,
    v_action,
    p_before_credential,
    p_after_credential,
    before_pages,
    after_pages
  );
end;
$$;

CREATE FUNCTION public.rpc_catalog_list(p_table text) RETURNS TABLE(id uuid, name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $_$
declare
  v_table text := lower(trim(p_table));
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_col text := 'name';
  v_owner_table boolean := v_table = any (array[
    'service_centers',
    'departments',
    'job_roles',
    'cost_centers',
    'stock_centers',
    'manufacturers'
  ]);
begin
  if v_table not in (
    'service_centers',
    'departments',
    'job_roles',
    'cost_centers',
    'stock_centers',
    'manufacturers',
    'execution_types'
  ) then
    raise exception 'Tabela invalida.';
  end if;

  if v_table = 'stock_centers' then
    v_col := 'warehouse_name';
  end if;

  if v_owner_table and not v_is_master then
    if v_owner is null then
      return;
    end if;
    return query execute format(
      'select id, %I as name from public.%I where account_owner_id = $1 order by %I',
      v_col,
      v_table,
      v_col
    ) using v_owner;
  end if;

  return query execute format(
    'select id, %I as name from public.%I order by %I',
    v_col,
    v_table,
    v_col
  );
end;
$_$;

CREATE FUNCTION public.rpc_catalog_resolve(p_table text, p_nome text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $_$
declare
  v_table text := lower(trim(p_table));
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_col text := 'name';
  v_owner_table boolean := v_table = any (array[
    'service_centers',
    'departments',
    'job_roles',
    'cost_centers',
    'stock_centers',
    'manufacturers'
  ]);
  v_id uuid;
  v_nome text := trim(coalesce(p_nome, ''));
begin
  if v_nome = '' then
    return null;
  end if;

  if v_table not in (
    'service_centers',
    'departments',
    'job_roles',
    'cost_centers',
    'stock_centers',
    'manufacturers',
    'execution_types'
  ) then
    raise exception 'Tabela invalida.';
  end if;

  if v_table = 'stock_centers' then
    v_col := 'warehouse_name';
  end if;

  if v_owner_table and not v_is_master then
    if v_owner is null then
      return null;
    end if;

    execute format('select id from public.%I where lower(%I) = lower($1) and account_owner_id = $2 limit 1', v_table, v_col)
      into v_id
      using v_nome, v_owner;
    if v_id is not null then
      return v_id;
    end if;

    execute format('select id from public.%I where %I ilike $1 and account_owner_id = $2 limit 1', v_table, v_col)
      into v_id
      using v_nome, v_owner;
    if v_id is not null then
      return v_id;
    end if;

    execute format('select id from public.%I where %I ilike $1 and account_owner_id = $2 limit 1', v_table, v_col)
      into v_id
      using '%' || v_nome || '%', v_owner;
    return v_id;
  end if;

  execute format('select id from public.%I where lower(%I) = lower($1) limit 1', v_table, v_col)
    into v_id
    using v_nome;
  if v_id is not null then
    return v_id;
  end if;

  execute format('select id from public.%I where %I ilike $1 limit 1', v_table, v_col)
    into v_id
    using v_nome;
  if v_id is not null then
    return v_id;
  end if;

  execute format('select id from public.%I where %I ilike $1 limit 1', v_table, v_col)
    into v_id
    using '%' || v_nome || '%';
  return v_id;
end;
$_$;

CREATE FUNCTION public.rpc_service_center_cost_center(p_centro_servico_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_id uuid;
begin
  if p_centro_servico_id is null then
    return null;
  end if;

  if v_is_master then
    select cost_center_id
      into v_id
      from public.service_centers
     where id = p_centro_servico_id
     limit 1;
    return v_id;
  end if;

  if v_owner is null then
    return null;
  end if;

  select cost_center_id
    into v_id
    from public.service_centers
   where id = p_centro_servico_id
     and account_owner_id = v_owner
   limit 1;
  return v_id;
end;
$$;

CREATE FUNCTION public.rpc_stock_entries_create_full(p_material_id uuid, p_quantidade numeric, p_centro_estoque uuid, p_data_entrada timestamp with time zone, p_status uuid DEFAULT NULL::uuid, p_usuario_id uuid DEFAULT NULL::uuid) RETURNS SETOF public.stock_entries
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := coalesce(p_usuario_id, auth.uid());
  v_perm boolean := public.has_permission('estoque.write'::text) or public.has_permission('entradas.write'::text);
  v_id uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := v_user;
  end if;

  if p_status is null then
    insert into public.stock_entries (
      "material_id",
      quantity,
      stock_center_id,
      "entry_date",
      "responsible_user",
      account_owner_id
    ) values (
      p_material_id,
      p_quantidade,
      p_centro_estoque,
      p_data_entrada,
      v_user,
      v_owner
    ) returning id into v_id;
  else
    insert into public.stock_entries (
      "material_id",
      quantity,
      stock_center_id,
      "entry_date",
      status,
      "responsible_user",
      account_owner_id
    ) values (
      p_material_id,
      p_quantidade,
      p_centro_estoque,
      p_data_entrada,
      p_status,
      v_user,
      v_owner
    ) returning id into v_id;
  end if;

  return query
    select *
      from public.stock_entries e
     where e.id = v_id
       and (v_is_master or e.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.rpc_stock_entries_update_full(p_id uuid, p_material_id uuid, p_quantidade numeric, p_centro_estoque uuid, p_data_entrada timestamp with time zone, p_status uuid, p_usuario_id uuid DEFAULT NULL::uuid) RETURNS SETOF public.stock_entries
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := coalesce(p_usuario_id, auth.uid());
  v_perm boolean := public.has_permission('estoque.write'::text) or public.has_permission('entradas.write'::text);
  v_row_owner uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.stock_entries
   where id = p_id;

  if v_row_owner is null then
    raise exception 'entrada_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.stock_entries
     set "material_id" = p_material_id,
         quantity = p_quantidade,
         stock_center_id = p_centro_estoque,
         "entry_date" = p_data_entrada,
         status = p_status,
         "updated_by_user_id" = v_user,
         "updated_at" = now()
   where id = p_id;

  return query
    select *
      from public.stock_entries e
     where e.id = p_id
       and (v_is_master or e.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.rpc_hht_monthly_create_full(p_mes_ref date, p_centro_servico_id uuid, p_status_hht_id uuid DEFAULT NULL::uuid, p_qtd_pessoas integer DEFAULT 0, p_horas_mes_base numeric DEFAULT 0, p_escala_factor numeric DEFAULT 1, p_horas_afastamento numeric DEFAULT 0, p_horas_ferias numeric DEFAULT 0, p_horas_treinamento numeric DEFAULT 0, p_horas_outros_descontos numeric DEFAULT 0, p_horas_extras numeric DEFAULT 0, p_modo text DEFAULT 'simples'::text, p_hht_informado numeric DEFAULT NULL::numeric) RETURNS SETOF public.hht_monthly
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('hht_value.write'::text);
  v_status uuid;
  v_id uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := auth.uid();
  end if;

  if p_mes_ref is null then
    raise exception 'mes_ref_required' using errcode = 'P0001';
  end if;

  if p_centro_servico_id is null then
    raise exception 'centro_servico_required' using errcode = 'P0001';
  end if;

  if p_status_hht_id is null then
    select id into v_status
      from public.hht_statuses
     where lower(status) = 'is_active'
     limit 1;
  else
    v_status := p_status_hht_id;
  end if;

  if v_status is null then
    raise exception 'status_hht_required' using errcode = 'P0001';
  end if;

  insert into public.hht_monthly (
    month_ref,
    service_center_id,
    hht_status_id,
    people_count,
    base_month_hours,
    scale_factor,
    leave_hours,
    vacation_hours,
    training_hours,
    other_discount_hours,
    overtime_hours,
    mode,
    reported_hht,
    created_by,
    updated_by,
    account_owner_id
  ) values (
    p_mes_ref,
    p_centro_servico_id,
    v_status,
    coalesce(p_qtd_pessoas, 0),
    coalesce(p_horas_mes_base, 0),
    coalesce(p_escala_factor, 1),
    coalesce(p_horas_afastamento, 0),
    coalesce(p_horas_ferias, 0),
    coalesce(p_horas_treinamento, 0),
    coalesce(p_horas_outros_descontos, 0),
    coalesce(p_horas_extras, 0),
    coalesce(p_modo, 'simples'),
    p_hht_informado,
    auth.uid(),
    auth.uid(),
    v_owner
  )
  returning id into v_id;

  return query
    select *
      from public.hht_monthly h
     where h.id = v_id
       and (v_is_master or h.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.rpc_hht_monthly_update_full(p_id uuid, p_mes_ref date DEFAULT NULL::date, p_centro_servico_id uuid DEFAULT NULL::uuid, p_status_hht_id uuid DEFAULT NULL::uuid, p_qtd_pessoas integer DEFAULT NULL::integer, p_horas_mes_base numeric DEFAULT NULL::numeric, p_escala_factor numeric DEFAULT NULL::numeric, p_horas_afastamento numeric DEFAULT NULL::numeric, p_horas_ferias numeric DEFAULT NULL::numeric, p_horas_treinamento numeric DEFAULT NULL::numeric, p_horas_outros_descontos numeric DEFAULT NULL::numeric, p_horas_extras numeric DEFAULT NULL::numeric, p_modo text DEFAULT NULL::text, p_hht_informado numeric DEFAULT NULL::numeric) RETURNS SETOF public.hht_monthly
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_perm boolean := public.has_permission('hht_value.write'::text);
  v_row_owner uuid;
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.hht_monthly
   where id = p_id;

  if v_row_owner is null then
    raise exception 'hht_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.hht_monthly
     set month_ref = coalesce(p_mes_ref, month_ref),
         service_center_id = coalesce(p_centro_servico_id, service_center_id),
         hht_status_id = coalesce(p_status_hht_id, hht_status_id),
         people_count = coalesce(p_qtd_pessoas, people_count),
         base_month_hours = coalesce(p_horas_mes_base, base_month_hours),
         scale_factor = coalesce(p_escala_factor, scale_factor),
         leave_hours = coalesce(p_horas_afastamento, leave_hours),
         vacation_hours = coalesce(p_horas_ferias, vacation_hours),
         training_hours = coalesce(p_horas_treinamento, training_hours),
         other_discount_hours = coalesce(p_horas_outros_descontos, other_discount_hours),
         overtime_hours = coalesce(p_horas_extras, overtime_hours),
         mode = coalesce(p_modo, mode),
         reported_hht = coalesce(p_hht_informado, reported_hht),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_id;

  return query
    select *
      from public.hht_monthly h
     where h.id = p_id
       and (v_is_master or h.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.rpc_people_full() RETURNS TABLE(id uuid, name text, registration_number text, hire_date timestamp with time zone, termination_date timestamp with time zone, created_by_user_id uuid, created_by_name text, created_by_username text, updated_by_user_id uuid, updated_by_name text, updated_by_username text, created_at timestamp with time zone, updated_at timestamp with time zone, service_center_id uuid, department_id uuid, job_role_id uuid, cost_center_id uuid, execution_type_id uuid, is_active boolean, service_center_name text, department_name text, job_role text, cost_center_name text, execution_type text, location_name text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    pv.id,
    pv.name,
    pv.registration_number,
    pv.hire_date,
    pv.termination_date,
    pv.created_by_user_id,
    pv.created_by_name,
    pv.created_by_username,
    pv.updated_by_user_id,
    pv.updated_by_name,
    pv.updated_by_username,
    pv.created_at,
    pv.updated_at,
    pv.service_center_id,
    pv.department_id,
    pv.job_role_id,
    pv.cost_center_id,
    pv.execution_type_id,
    pv.is_active,
    pv.service_center_name,
    pv.department_name,
    pv.job_role,
    pv.cost_center_name,
    pv.execution_type,
    pv.location_name
  from public.people_view pv;
$$;

CREATE FUNCTION public.rpc_people_count_service_center(p_centro_servico_id uuid) RETURNS TABLE(total integer)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::integer as total
  from public.people_view pv
  where coalesce(pv.is_active, true) = true
    and pv.service_center_id = p_centro_servico_id;
$$;

CREATE FUNCTION public.rpc_people_create_full(p_nome text, p_matricula text, p_data_admissao date, p_centro_servico_id uuid, p_setor_id uuid, p_cargo_id uuid, p_centro_custo_id uuid, p_tipo_execucao_id uuid, p_observacao text DEFAULT NULL::text, p_data_demissao date DEFAULT NULL::date, p_ativo boolean DEFAULT true, p_usuario_id uuid DEFAULT NULL::uuid) RETURNS SETOF public.people_view
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := case when v_is_master and p_usuario_id is not null then p_usuario_id else auth.uid() end;
  v_id uuid;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := v_user;
  end if;

  insert into public.people (
    name,
    registration_number,
    notes,
    service_center_id,
    department_id,
    job_role_id,
    cost_center_id,
    execution_type_id,
    "hire_date",
    "termination_date",
    "created_by_user_id",
    "created_at",
    "updated_at",
    is_active,
    account_owner_id
  ) values (
    p_nome,
    p_matricula,
    p_observacao,
    p_centro_servico_id,
    p_setor_id,
    p_cargo_id,
    p_centro_custo_id,
    p_tipo_execucao_id,
    p_data_admissao,
    p_data_demissao,
    v_user,
    now(),
    null,
    coalesce(p_ativo, true),
    v_owner
  )
  returning id into v_id;

  return query
    select pv.*
      from public.people_view pv
      join public.people p on p.id = pv.id
     where p.id = v_id
       and (v_is_master or p.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.rpc_people_summary() RETURNS TABLE(total_geral integer, por_centro jsonb, por_setor jsonb)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with base as (
    select
      coalesce(nullif(trim(pv.service_center_name), ''), 'Nao informado') as service_center,
      coalesce(nullif(trim(pv.department_name), ''), 'Nao informado') as setor
    from public.people_view pv
    where coalesce(pv.is_active, true) = true
  ),
  resumo_centro as (
    select
      service_center,
      count(*) as total
    from base
    group by service_center
    order by total desc, service_center asc
  ),
  resumo_setor as (
    select
      setor,
      count(*) as total
    from base
    group by setor
    order by total desc, setor asc
  )
  select
    (select count(*) from base) as total_geral,
    (select jsonb_agg(jsonb_build_object('service_center', service_center, 'total', total)) from resumo_centro) as por_centro,
    (select jsonb_agg(jsonb_build_object('setor', setor, 'total', total)) from resumo_setor) as por_setor;
$$;

CREATE FUNCTION public.rpc_people_update_full(p_id uuid, p_nome text, p_matricula text, p_data_admissao date, p_centro_servico_id uuid, p_setor_id uuid, p_cargo_id uuid, p_centro_custo_id uuid, p_tipo_execucao_id uuid, p_observacao text DEFAULT NULL::text, p_data_demissao date DEFAULT NULL::date, p_ativo boolean DEFAULT true, p_usuario_id uuid DEFAULT NULL::uuid, p_campos_alterados jsonb DEFAULT '[]'::jsonb) RETURNS SETOF public.people_view
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := case when v_is_master and p_usuario_id is not null then p_usuario_id else auth.uid() end;
  v_row_owner uuid;
begin
  if not v_is_master and not public.has_permission('pessoas.write'::text) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.people
   where id = p_id;

  if v_row_owner is null then
    raise exception 'pessoa_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.people
     set name = p_nome,
         registration_number = p_matricula,
         notes = p_observacao,
         service_center_id = p_centro_servico_id,
         department_id = p_setor_id,
         job_role_id = p_cargo_id,
         cost_center_id = p_centro_custo_id,
         execution_type_id = p_tipo_execucao_id,
         "hire_date" = p_data_admissao,
         "termination_date" = p_data_demissao,
         "updated_by_user_id" = v_user,
         "updated_at" = now(),
         is_active = coalesce(p_ativo, true)
   where id = p_id;

  if p_campos_alterados is not null
     and jsonb_typeof(p_campos_alterados) = 'array'
     and jsonb_array_length(p_campos_alterados) > 0 then
    insert into public.people_history (
      pessoa_id,
      edited_at,
      responsible_user,
      changed_fields,
      account_owner_id
    ) values (
      p_id,
      now(),
      v_user,
      p_campos_alterados,
      v_row_owner
    );
  end if;

  return query
    select pv.*
      from public.people_view pv
      join public.people p on p.id = pv.id
     where p.id = p_id
       and (v_is_master or p.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.rpc_stock_output_history(p_saida_id uuid) RETURNS TABLE(id uuid, output_id uuid, material_id uuid, material_snapshot jsonb, created_at timestamp with time zone, responsible_user uuid, usuario jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_saida_id IS NULL THEN
    RAISE EXCEPTION 'Saida invalida.' USING errcode = '22023';
  END IF;
  RETURN QUERY
  SELECT
    sh.id,
    sh.output_id,
    sh.material_id,
    sh.material_snapshot,
    sh.created_at,
    sh."responsible_user" AS responsible_user,
    json_build_object(
      'id', u.id,
      'display_name', u.display_name,
      'username', u.username,
      'email', u.email
    )::jsonb AS usuario
  FROM public.stock_output_history sh
  LEFT JOIN public.app_users u ON u.id = sh."responsible_user"::uuid
  WHERE sh.output_id = p_saida_id
  ORDER BY sh.created_at DESC;
END;
$$;

CREATE FUNCTION public.rpc_stock_output_check_exchange(p_material_id uuid, p_pessoa_id uuid) RETURNS TABLE(tem_saida boolean, ultima_saida_id uuid, troca_sequencia integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_status_cancelado_nome text := 'cancelado';
  v_status_cancelado_id uuid;
  v_owner uuid := public.my_owner_id();
  v_is_master boolean := public.is_master();
begin
  if p_material_id is null or p_pessoa_id is null then
    return;
  end if;

  if v_owner is null and not v_is_master then
    select account_owner_id into v_owner
      from public.people
     where id = p_pessoa_id
     limit 1;

    if v_owner is null then
      select account_owner_id into v_owner
        from public.materials
       where id = p_material_id
       limit 1;
    end if;
  end if;

  select id into v_status_cancelado_id
    from public.stock_output_statuses
   where lower(status) = v_status_cancelado_nome
   limit 1;

  with base as (
    select s.id
      from public.stock_outputs s
      left join public.stock_output_statuses st on st.id = s.status
     where s."material_id" = p_material_id
       and s."person_id" = p_pessoa_id
       and (
         v_is_master
         or s.account_owner_id = v_owner
         or (v_owner is not null and s.account_owner_id is null)
       )
       and not (
         (v_status_cancelado_id is not null and s.status = v_status_cancelado_id)
         or lower(coalesce(st.status::text, '')) = v_status_cancelado_nome
       )
     order by s."delivered_at" desc nulls last, s."created_at" desc nulls last, s.id desc
  )
  select
    count(*) > 0,
    (select id from base limit 1),
    count(*)::int
  into tem_saida, ultima_saida_id, troca_sequencia
  from base;

  return next;
end;
$$;

CREATE FUNCTION public.rpc_stock_outputs_create_full(p_pessoa_id uuid, p_material_id uuid, p_quantidade numeric, p_centro_estoque uuid, p_centro_custo uuid, p_centro_servico uuid, p_data_entrega timestamp with time zone, p_status uuid, p_usuario_id uuid DEFAULT NULL::uuid, p_is_troca boolean DEFAULT false, p_troca_de_saida uuid DEFAULT NULL::uuid, p_troca_sequencia integer DEFAULT NULL::integer) RETURNS SETOF public.stock_outputs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := coalesce(p_usuario_id, auth.uid());
  v_id uuid;
  v_perm boolean := public.has_permission('estoque.write'::text) or public.has_permission('estoque.saidas'::text);
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  if v_owner is null then
    v_owner := v_user;
  end if;

  insert into public.stock_outputs (
    "person_id",
    "material_id",
    quantity,
    stock_center_id,
    cost_center_id,
    service_center,
    "delivered_at",
    status,
    "responsible_user",
    "is_exchange",
    "exchange_from_output_id",
    "exchange_sequence",
    account_owner_id
  ) values (
    p_pessoa_id,
    p_material_id,
    p_quantidade,
    p_centro_estoque,
    p_centro_custo,
    p_centro_servico,
    p_data_entrega,
    p_status,
    v_user,
    coalesce(p_is_troca, false),
    p_troca_de_saida,
    coalesce(p_troca_sequencia, 0),
    v_owner
  ) returning id into v_id;

  return query
    select *
      from public.stock_outputs s
     where s.id = v_id
       and (v_is_master or s.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.rpc_stock_outputs_update_full(p_id uuid, p_pessoa_id uuid, p_material_id uuid, p_quantidade numeric, p_centro_estoque uuid, p_centro_custo uuid, p_centro_servico uuid, p_data_entrega timestamp with time zone, p_status uuid, p_usuario_id uuid DEFAULT NULL::uuid, p_is_troca boolean DEFAULT NULL::boolean, p_troca_de_saida uuid DEFAULT NULL::uuid, p_troca_sequencia integer DEFAULT NULL::integer) RETURNS SETOF public.stock_outputs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid := public.current_account_owner_id();
  v_is_master boolean := public.is_master();
  v_user uuid := coalesce(p_usuario_id, auth.uid());
  v_row_owner uuid;
  v_perm boolean := public.has_permission('estoque.write'::text) or public.has_permission('estoque.saidas'::text);
begin
  if not v_is_master and not v_perm then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_owner is null and not v_is_master then
    raise exception 'owner_not_resolved' using errcode = '42501';
  end if;

  select account_owner_id into v_row_owner
    from public.stock_outputs
   where id = p_id;

  if v_row_owner is null then
    raise exception 'saida_not_found' using errcode = 'P0001';
  end if;

  if not v_is_master and v_row_owner <> v_owner then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.stock_outputs
     set "person_id" = p_pessoa_id,
         "material_id" = p_material_id,
         quantity = p_quantidade,
         stock_center_id = p_centro_estoque,
         cost_center_id = p_centro_custo,
         service_center = p_centro_servico,
         "delivered_at" = p_data_entrega,
         status = p_status,
         "updated_by_user_id" = v_user,
         "updated_at" = now(),
         "is_exchange" = coalesce(p_is_troca, "is_exchange"),
         "exchange_from_output_id" = coalesce(p_troca_de_saida, "exchange_from_output_id"),
         "exchange_sequence" = coalesce(p_troca_sequencia, "exchange_sequence")
   where id = p_id;

  return query
    select *
      from public.stock_outputs s
     where s.id = p_id
       and (v_is_master or s.account_owner_id = v_owner);
end;
$$;

CREATE FUNCTION public.saidas_preflight_check(p_material_id uuid, p_pessoa_id uuid) RETURNS TABLE(troca_existente boolean, output_id uuid, material_id uuid, pessoa_id uuid, data_entrega timestamp with time zone, data_troca timestamp with time zone, status_id uuid)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.saidas_preflight_check(p_material_id, p_pessoa_id, public.my_owner_id(), NULL);
END;
$$;

CREATE FUNCTION public.saidas_preflight_check(p_material_id uuid, p_pessoa_id uuid, p_owner uuid DEFAULT public.my_owner_id(), p_saida_id uuid DEFAULT NULL::uuid) RETURNS TABLE(troca_existente boolean, output_id uuid, material_id uuid, pessoa_id uuid, data_entrega timestamp with time zone, data_troca timestamp with time zone, status_id uuid)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_status_cancelado_id uuid := 'e57d3be9-8fb9-4f4a-a63d-da4d3139a5ef';
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.id,
      s."material_id",
      s."person_id",
      s."delivered_at",
      s."exchange_at",
      s.status
    FROM public.stock_outputs s
    WHERE s."material_id" = p_material_id
      AND s."person_id" = p_pessoa_id
      AND (
        p_owner IS NULL
        OR s.account_owner_id IS NULL
        OR s.account_owner_id = p_owner
      )
      AND (p_saida_id IS NULL OR s.id <> p_saida_id)
      AND coalesce(s.status, '00000000-0000-0000-0000-000000000000') <> v_status_cancelado_id
    ORDER BY s."delivered_at" DESC NULLS LAST, s."created_at" DESC NULLS LAST, s.id DESC
    LIMIT 1
  )
  SELECT
    (SELECT count(*) > 0 FROM base) AS troca_existente,
    b.id AS output_id,
    b."material_id" AS material_id,
    b."person_id" AS pessoa_id,
    b."delivered_at" AS data_entrega,
    b."exchange_at" AS data_troca,
    b.status AS status_id
  FROM base b;
END;
$$;

CREATE FUNCTION public.search_users(p_term text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, display_name text, username text, email_masked text, is_active boolean, parent_user_id uuid, owner_scope uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_owner uuid;
  v_is_master boolean;
begin
  if p_term is null or length(trim(p_term)) < 2 then
    return;
  end if;

  v_owner := public.current_account_owner_id();
  v_is_master := public.is_master();

  return query
    select u.id,
           u.display_name,
           u.username,
           public.mask_email(u.email) as email_masked,
           u.is_active,
           u.parent_user_id,
           coalesce(u.parent_user_id, u.id) as owner_scope
      from public.app_users u
     where (
        v_is_master
        or coalesce(u.parent_user_id, u.id) = v_owner
      )
       and (
         u.username ilike '%' || trim(p_term) || '%'
         or u.display_name ilike '%' || trim(p_term) || '%'
         or u.email ilike '%' || trim(p_term) || '%'
       )
     order by u.display_name nulls last, u.username nulls last
     limit least(greatest(p_limit, 1), 50)
    offset greatest(p_offset, 0);
end;
$$;

CREATE FUNCTION public.set_account_owner_id_default() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.account_owner_id is null then
    new.account_owner_id = public.my_owner_id();
  end if;
  return new;
end;
$$;

CREATE FUNCTION public.set_current_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE FUNCTION public.set_data_troca() RETURNS trigger
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_validade integer;
begin
  select coalesce("shelf_life_days", 0)
    into v_validade
    from public.materials
   where id = new."material_id";

  if new."delivered_at" is not null then
    new."exchange_at" := new."delivered_at" + (v_validade || ' days')::interval;
  else
    new."exchange_at" := null;
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.set_owner_materiais() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
begin
  if new.account_owner_id is null then
    new.account_owner_id := public.my_owner_id();
  end if;
  return new;
end;
$$;

CREATE FUNCTION public.set_owner_material_relacionado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_owner uuid;
begin
  select m.account_owner_id
    into v_owner
    from public.materials m
   where m.id = new.material_id;

  if v_owner is null then
    raise exception 'Material sem owner; nao pode vincular.';
  end if;

  if new.account_owner_id is null then
    new.account_owner_id := v_owner;
  elsif v_owner is not null and new.account_owner_id <> v_owner then
    raise exception 'Owner do vinculo nao confere com o owner do material.';
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.set_owner_saidas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.account_owner_id is null then
    new.account_owner_id := public.my_owner_id();
  end if;
  return new;
end;
$$;

CREATE FUNCTION public.set_saida_troca_meta() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_status_cancelado_nome text := 'cancelado';
  v_status_cancelado_id uuid;
  v_prev record;
  v_seq integer := 0;
begin
  if coalesce(new."is_exchange", false) = false then
    new."is_exchange" := false;
    new."exchange_sequence" := coalesce(new."exchange_sequence", 0);
    return new;
  end if;

  select id into v_status_cancelado_id
    from public.stock_output_statuses
   where lower(status) = v_status_cancelado_nome
   limit 1;

  select s.id, s."exchange_sequence"
    into v_prev
    from public.stock_outputs s
    where s."material_id" = new."material_id"
      and s."person_id" = new."person_id"
      and not (
        (v_status_cancelado_id is not null and s.status = v_status_cancelado_id)
        or lower(coalesce(s.status::text, '')) = v_status_cancelado_nome
      )
    order by s."delivered_at" desc nulls last, s."created_at" desc nulls last, s.id desc
    limit 1;

  if v_prev.id is not null then
    new."exchange_from_output_id" := coalesce(new."exchange_from_output_id", v_prev.id);
    v_seq := coalesce(v_prev."exchange_sequence", 0) + 1;
  else
    v_seq := 1;
  end if;

  new."exchange_sequence" := coalesce(new."exchange_sequence", v_seq);
  new."is_exchange" := true;
  return new;
end;
$$;

CREATE FUNCTION public.normalize_login_name() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.login_name is null or btrim(new.login_name) = '' then
    new.login_name := lower(btrim(coalesce(new.username, '')));
  else
    new.login_name := lower(btrim(new.login_name));
  end if;

  if new.login_name is null or new.login_name = '' then
    raise exception 'login_name nao pode ser vazio';
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.sync_app_users_from_dependentes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.app_users as u (
      id,
      username,
      login_name,
      display_name,
      email,
      credential,
      page_permissions,
      is_active,
      created_at,
      updated_at,
      parent_user_id,
      perm_version
    )
    values (
      new.auth_user_id,
      coalesce(nullif(new.username, ''), 'dep_' || left(new.auth_user_id::text, 8)),
      lower(btrim(coalesce(nullif(new.username, ''), 'dep_' || left(new.auth_user_id::text, 8)))),
      coalesce(nullif(new.display_name, ''), nullif(new.username, ''), 'Dependente'),
      new.email,
      new.credential,
      new.page_permissions,
      coalesce(new.is_active, true),
      coalesce(new.created_at, now()),
      coalesce(new.updated_at, now()),
      new.owner_user_id,
      1
    )
    on conflict (id) do update
      set username = excluded.username,
          login_name = excluded.login_name,
          display_name = excluded.display_name,
          email = excluded.email,
          credential = excluded.credential,
          page_permissions = excluded.page_permissions,
          is_active = excluded.is_active,
          parent_user_id = excluded.parent_user_id,
          perm_version = coalesce(u.perm_version, 1);
    return new;
  elsif tg_op = 'UPDATE' then
    update public.app_users
      set username = coalesce(nullif(new.username, ''), username),
          login_name = lower(btrim(coalesce(nullif(new.username, ''), username, login_name))),
          display_name = coalesce(nullif(new.display_name, ''), display_name),
          email = new.email,
          credential = new.credential,
          page_permissions = new.page_permissions,
          is_active = coalesce(new.is_active, true),
          parent_user_id = new.owner_user_id,
          updated_at = now()
    where id = new.auth_user_id;
    return new;
  elsif tg_op = 'DELETE' then
    delete from public.app_users where id = old.auth_user_id;
    return old;
  end if;
  return null;
end;
$$;

CREATE FUNCTION public.sync_pessoas_referencias() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  if new.service_center_id is null then
    raise exception 'Centro de servico ID obrigatorio.';
  end if;
  if not exists (select 1 from public.service_centers cs where cs.id = new.service_center_id) then
    raise exception 'Centro de servico invalido.';
  end if;

  if new.department_id is null then
    raise exception 'Setor ID obrigatorio.';
  end if;
  if not exists (select 1 from public.departments st where st.id = new.department_id) then
    raise exception 'Setor invalido.';
  end if;

  if new.job_role_id is null then
    raise exception 'Cargo ID obrigatorio.';
  end if;
  if not exists (select 1 from public.job_roles cg where cg.id = new.job_role_id) then
    raise exception 'Cargo invalido.';
  end if;

  if new.cost_center_id is null then
    raise exception 'Centro de custo ID obrigatorio.';
  end if;
  if not exists (select 1 from public.cost_centers cc where cc.id = new.cost_center_id) then
    raise exception 'Centro de custo invalido.';
  end if;

  if new.execution_type_id is null then
    raise exception 'Tipo de execucao ID obrigatorio.';
  end if;
  if not exists (select 1 from public.execution_types te where te.id = new.execution_type_id) then
    raise exception 'Tipo de execucao invalido.';
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.sync_user_ban_with_status(p_user_id uuid, p_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
begin
  update auth.users
     set banned_until = case when coalesce(p_active, true) = false then 'infinity'::timestamptz else null end
   where id = p_user_id;
end;
$$;

CREATE FUNCTION public.trg_recalc_troca() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform public.recalcular_trocas(new."person_id", new."material_id");
  return new;
end;
$$;

CREATE FUNCTION public.validar_cancelamento_entrada() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_status_cancelado_nome text := 'cancelado';
  v_status_cancelado_id uuid;
  v_status_saida_cancelado_id uuid;
  v_total_saidas numeric := 0;
  v_total_entradas_restantes numeric := 0;
begin
  select id into v_status_cancelado_id
    from public.stock_entry_statuses
   where lower(status) = v_status_cancelado_nome
   limit 1;

  if not (
    (v_status_cancelado_id is not null and new.status = v_status_cancelado_id)
    or lower(coalesce(new.status::text, '')) = v_status_cancelado_nome
  ) then
    return new;
  end if;

  if (v_status_cancelado_id is not null and old.status = v_status_cancelado_id)
     or lower(coalesce(old.status::text, '')) = v_status_cancelado_nome then
    return new;
  end if;

  select coalesce(sum(quantity), 0) into v_total_entradas_restantes
    from public.stock_entries e
   where e."material_id" = new."material_id"
     and e.id <> old.id
     and not (
       (v_status_cancelado_id is not null and e.status = v_status_cancelado_id)
       or lower(coalesce(e.status::text, '')) = v_status_cancelado_nome
     );

  select id into v_status_saida_cancelado_id
    from public.stock_output_statuses
   where lower(status) = v_status_cancelado_nome
   limit 1;

  select coalesce(sum(quantity), 0) into v_total_saidas
    from public.stock_outputs s
   where s."material_id" = new."material_id"
     and not (
       (v_status_saida_cancelado_id is not null and s.status = v_status_saida_cancelado_id)
       or lower(coalesce(s.status::text, '')) = v_status_cancelado_nome
     );

  if v_total_saidas > v_total_entradas_restantes then
    raise exception
      'Nao e possivel cancelar esta entrada: ha % saidas registradas e o estoque ficaria com % apos o cancelamento.',
      v_total_saidas, v_total_entradas_restantes
      using errcode = 'P0001',
            detail = format(
              'Saidas ativas: %s; Entradas apos cancelamento: %s; Entrada id: %s',
              v_total_saidas, v_total_entradas_restantes, new.id
            ),
            hint = 'Estorne ou ajuste as saidas before de cancelar a entrada.';
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.validar_saldo_saida() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
declare
  v_saldo numeric;
  v_quantidade numeric := coalesce(new.quantity, 0);
  v_status_cancelado_nome text := 'cancelado';
  v_status_cancelado_id uuid;
begin
  select id into v_status_cancelado_id
    from public.stock_output_statuses
   where lower(status) = v_status_cancelado_nome
   limit 1;

  if v_quantidade <= 0
     or (v_status_cancelado_id is not null and new.status = v_status_cancelado_id)
     or lower(coalesce(new.status::text, '')) = v_status_cancelado_nome then
    return new;
  end if;

  with entradas as (
    select coalesce(sum(quantity), 0) as total
    from public.stock_entries
    where "material_id" = new."material_id"
  ),
  saidas as (
    select coalesce(sum(quantity), 0) as total
    from public.stock_outputs
    where "material_id" = new."material_id"
      and not (
        (v_status_cancelado_id is not null and status = v_status_cancelado_id)
        or lower(coalesce(status::text, '')) = v_status_cancelado_nome
      )
      and (old.id is null or id <> old.id)
  )
  select e.total - s.total into v_saldo
  from public.stock_entries e, saidas s;

  if v_quantidade > v_saldo then
    raise exception 'Quantidade % excede estoque disponivel (%) para o material %.', v_quantidade, v_saldo, new."material_id"
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.verificar_duplicidade_material_relacionado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE
  alvo uuid;
BEGIN
  alvo := COALESCE(NEW.material_id, OLD.material_id);
  IF alvo IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.atualizar_hashes_material(alvo);

  IF EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id <> alvo AND m.full_hash = (SELECT full_hash FROM public.materials WHERE id = alvo)
  ) THEN
    RAISE EXCEPTION 'Material duplicado com mesmas cores/caracteristicas e C.A.';
  END IF;

  RETURN NULL;
END;
$$;
