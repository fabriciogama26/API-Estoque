-- Ajusta auditoria do cadastro base: nao registrar INSERT no historico.
create or replace function public.basic_registration_log_changes()
returns trigger as $$
declare
  old_row jsonb;
  new_row jsonb;
  old_base jsonb;
  new_base jsonb;
  fields text[];
  record_id uuid;
  record_name text;
  record_created_at timestamp with time zone;
  record_updated_at timestamp with time zone;
  record_created_by uuid;
  record_updated_by uuid;
  actor uuid;
  action_label text;
  owner_id uuid;
begin
  if tg_op = 'INSERT' then
    return new;
  elsif tg_op = 'UPDATE' then
    new_row = to_jsonb(new);
    old_row = to_jsonb(old);
    action_label = 'UPDATE';
  else
    new_row = null;
    old_row = to_jsonb(old);
    action_label = 'DELETE';
  end if;

  old_base = coalesce(old_row, '{}'::jsonb)
    - 'updated_at' - 'updated_by_user_id' - 'created_at' - 'created_by_user_id'
    - 'criado_em' - 'account_owner_id';
  new_base = coalesce(new_row, '{}'::jsonb)
    - 'updated_at' - 'updated_by_user_id' - 'created_at' - 'created_by_user_id'
    - 'criado_em' - 'account_owner_id';

  if action_label = 'UPDATE' and old_base is not distinct from new_base then
    return new;
  end if;

  select array_agg(key order by key) into fields
  from (
    select key from jsonb_each(coalesce(old_base, '{}'::jsonb))
    union
    select key from jsonb_each(coalesce(new_base, '{}'::jsonb))
  ) keys
  where (coalesce(old_base, '{}'::jsonb)->key) is distinct from (coalesce(new_base, '{}'::jsonb)->key);

  record_id = coalesce((new_row->>'id')::uuid, (old_row->>'id')::uuid);
  record_name = coalesce(new_row->>'nome', new_row->>'fabricante', new_row->>'almox', old_row->>'nome', old_row->>'fabricante', old_row->>'almox');
  record_created_at = coalesce(
    (new_row->>'created_at')::timestamp with time zone,
    (new_row->>'criado_em')::timestamp with time zone,
    (old_row->>'created_at')::timestamp with time zone,
    (old_row->>'criado_em')::timestamp with time zone
  );
  record_updated_at = coalesce(
    (new_row->>'updated_at')::timestamp with time zone,
    (old_row->>'updated_at')::timestamp with time zone,
    record_created_at
  );
  record_created_by = coalesce((new_row->>'created_by_user_id')::uuid, (old_row->>'created_by_user_id')::uuid);
  record_updated_by = coalesce((new_row->>'updated_by_user_id')::uuid, (old_row->>'updated_by_user_id')::uuid);
  actor = auth.uid();
  owner_id = coalesce((new_row->>'account_owner_id')::uuid, (old_row->>'account_owner_id')::uuid, public.my_owner_id());

  insert into public.basic_registration_history (
    table_name,
    record_id,
    record_name,
    action,
    changed_fields,
    before,
    after,
    record_created_at,
    record_updated_at,
    record_created_by_user_id,
    record_updated_by_user_id,
    changed_by_user_id,
    account_owner_id
  )
  values (
    tg_table_name,
    record_id,
    record_name,
    action_label,
    coalesce(fields, '{}'::text[]),
    old_row,
    new_row,
    record_created_at,
    record_updated_at,
    record_created_by,
    record_updated_by,
    actor,
    owner_id
  );

  if action_label = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$ language plpgsql;
