-- Alinha o schema do Supabase com o backend adicionando campos esperados
-- pelas funcoes serverless para pessoas e acidentes.

alter table if exists public.pessoas
  add column if not exists "dataAdmissao" timestamptz,
  add column if not exists "tipoExecucao" text;

-- Garante que registros existentes tenham um valor padrao valido.
update public.pessoas
set "tipoExecucao" = coalesce(nullif(trim("tipoExecucao"), ''), 'Nao informado')
where "tipoExecucao" is null or trim("tipoExecucao") = '';

alter table if exists public.pessoas
  alter column "tipoExecucao" set default 'Nao informado',
  alter column "tipoExecucao" set not null;

alter table if exists public.acidentes
  add column if not exists hht numeric(14,2) default 0 check (hht >= 0);

alter table if exists public.acidentes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'acidentes'
      and policyname = 'acidentes select'
  ) then
    execute $pol$
      create policy "acidentes select" on public.acidentes
        for select using (auth.role() in ('authenticated', 'service_role'));
    $pol$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'acidentes'
      and policyname = 'acidentes modify'
  ) then
    execute $pol$
      create policy "acidentes modify" on public.acidentes
        for all using (auth.role() = 'service_role')
        with check (auth.role() = 'service_role');
    $pol$;
  end if;
end
$$;
