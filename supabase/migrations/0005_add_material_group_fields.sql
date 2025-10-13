alter table if exists public.materiais
  add column if not exists "grupoMaterial" text,
  add column if not exists "numeroCalcado" text,
  add column if not exists "numeroVestimenta" text,
  add column if not exists "numeroEspecifico" text,
  add column if not exists "chaveUnica" text;

create unique index if not exists materiais_chave_unica_idx
  on public.materiais (lower("chaveUnica"))
  where "chaveUnica" is not null and "chaveUnica" <> '';

create index if not exists materiais_grupo_material_idx
  on public.materiais (lower("grupoMaterial"));
