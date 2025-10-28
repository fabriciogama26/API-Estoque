-- Adiciona policy de insert para usuarios autenticados caso nao exista (complementa 0023).

alter table if exists public.acidente_historico enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'acidente_historico'
      and policyname = 'acidente_historico_insert_authenticated'
  ) then
    create policy acidente_historico_insert_authenticated on public.acidente_historico
      for insert to authenticated with check (true);
  end if;
end
$$;
