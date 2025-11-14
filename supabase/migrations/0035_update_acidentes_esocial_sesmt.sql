do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'acidentes'
      and column_name = 'data_esocial'
  ) then
    alter table public.acidentes
      add column data_esocial timestamptz;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'acidentes'
      and column_name = 'sesmt'
  ) then
    alter table public.acidentes
      add column sesmt boolean not null default false;
  end if;

  -- Migrar dados antigos, se existirem
  begin
    execute 'update public.acidentes set data_esocial = data_sesmt where data_esocial is null and data_sesmt is not null';
  exception
    when undefined_column then null;
  end;

  begin
    execute 'update public.acidentes set sesmt = coalesce(esocial, false)';
  exception
    when undefined_column then null;
  end;

  -- Remover colunas antigas, se existirem
  begin
    alter table public.acidentes drop column if exists esocial;
  exception
    when undefined_column then null;
  end;

  begin
    alter table public.acidentes drop column if exists data_sesmt;
  exception
    when undefined_column then null;
  end;
end
$$;
