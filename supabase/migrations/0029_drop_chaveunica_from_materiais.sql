DROP VIEW IF EXISTS public.materiais_view CASCADE;
DROP INDEX IF EXISTS public.materiais_chave_unica_idx CASCADE;

ALTER TABLE IF EXISTS public.materiais
  DROP COLUMN IF EXISTS "chaveUnica";
