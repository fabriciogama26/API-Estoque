do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'acidentes'
      and column_name = 'data_sesmt'
  ) then
    alter table public.acidentes
      add column data_sesmt timestamptz;
  end if;
end
$$;
