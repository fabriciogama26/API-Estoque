-- Camadas de deduplicação para materiais
-- 1) fabricante + grupoMaterial + grupoMaterialItens + numeroEspecifico
-- 2) camada 1 + valorUnitario + CA + cores + caracteristicas (ordenadas)

-- Adiciona colunas de hash se não existirem
ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS hash_base text,
  ADD COLUMN IF NOT EXISTS hash_completo text;

-- Função auxiliar: normaliza texto
CREATE OR REPLACE FUNCTION public.fn_normalize_text(p_val text)
RETURNS text LANGUAGE sql IMMUTABLE AS
$$
SELECT LOWER(TRIM(COALESCE(p_val, '')));
$$;

-- Função: resolve nome do item a partir da tabela grupos_material_itens, com fallback para campos do material
CREATE OR REPLACE FUNCTION public.material_resolve_item_nome(p_material_id uuid)
RETURNS text LANGUAGE sql STABLE AS
$$
SELECT COALESCE(
  gmi.nome,
  m.nome::text,
  ''
)
FROM public.materiais m
LEFT JOIN public.grupos_material_itens gmi
  ON gmi.id = m.nome
WHERE m.id = p_material_id;
$$;

-- Função: hash camada 1 (fabricante + grupo + item + numeroEspecifico)
CREATE OR REPLACE FUNCTION public.material_hash_base(p_material_id uuid)
RETURNS text LANGUAGE sql STABLE AS
$$
SELECT md5(
  fn_normalize_text(
    CONCAT_WS('|',
      COALESCE(m.fabricante::text, ''),
      COALESCE(m."grupoMaterial"::text, ''),
      COALESCE(public.material_resolve_item_nome(m.id), ''),
      COALESCE(m."numeroEspecifico"::text, '')
    )
  )
)
FROM public.materiais m
WHERE m.id = p_material_id;
$$;

-- Função: hash camada 2 (base + valor + CA + cores + características)
CREATE OR REPLACE FUNCTION public.material_hash_completo(p_material_id uuid)
RETURNS text LANGUAGE sql STABLE AS
$$
WITH cores_agg AS (
  SELECT
    mgc.material_id,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT fn_normalize_text(c.cor) ORDER BY fn_normalize_text(c.cor)), ';') AS cores_string
  FROM public.material_grupo_cor mgc
  LEFT JOIN public.cor c ON c.id::text = mgc.grupo_material_cor::text
  WHERE mgc.material_id = p_material_id
  GROUP BY mgc.material_id
),
caracteristicas_agg AS (
  SELECT
    mgce.material_id,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT fn_normalize_text(ce.caracteristica_material) ORDER BY fn_normalize_text(ce.caracteristica_material)), ';') AS caracteristicas_string
  FROM public.material_grupo_caracteristica_epi mgce
  LEFT JOIN public.caracteristica_epi ce ON ce.id::text = mgce.grupo_caracteristica_epi::text
  WHERE mgce.material_id = p_material_id
  GROUP BY mgce.material_id
)
SELECT md5(
  fn_normalize_text(
    CONCAT_WS('|',
      COALESCE(m.fabricante::text, ''),
      COALESCE(m."grupoMaterial"::text, ''),
      COALESCE(public.material_resolve_item_nome(m.id), ''),
      COALESCE(m."numeroEspecifico"::text, ''),
      COALESCE(TO_CHAR(m."valorUnitario", 'FM999999990.00'), ''),
      COALESCE(NULLIF(m.ca, ''), ''),
      COALESCE(cores_agg.cores_string, ''),
      COALESCE(caracteristicas_agg.caracteristicas_string, '')
    )
  )
)
FROM public.materiais m
LEFT JOIN cores_agg ON cores_agg.material_id = m.id
LEFT JOIN caracteristicas_agg ON caracteristicas_agg.material_id = m.id
WHERE m.id = p_material_id;
$$;

-- Função: recalcula hashes na linha alvo
CREATE OR REPLACE FUNCTION public.atualizar_hashes_material(p_material_id uuid)
RETURNS void LANGUAGE plpgsql AS
$$
BEGIN
  UPDATE public.materiais
  SET
    hash_base = public.material_hash_base(p_material_id),
    hash_completo = public.material_hash_completo(p_material_id)
  WHERE id = p_material_id;
END;
$$;

-- Trigger BEFORE insert/update para setar hashes e validar duplicidade
CREATE OR REPLACE FUNCTION public.evitar_duplicidade_material()
RETURNS trigger AS
$$
BEGIN
  NEW.hash_base := public.material_hash_base(NEW.id);
  NEW.hash_completo := public.material_hash_completo(NEW.id);

  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> NEW.id AND m.hash_completo = NEW.hash_completo
  ) THEN
    RAISE EXCEPTION 'Material duplicado com mesmas cores/características, valor e CA.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> NEW.id AND m.hash_base = NEW.hash_base
  ) THEN
    RAISE EXCEPTION 'Material duplicado (mesmo fabricante/grupo/item/número específico).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS impedir_material_duplicado ON public.materiais;
CREATE TRIGGER impedir_material_duplicado
BEFORE INSERT OR UPDATE ON public.materiais
FOR EACH ROW
EXECUTE FUNCTION public.evitar_duplicidade_material();

-- Trigger para revalidar após mudanças em cores/características
CREATE OR REPLACE FUNCTION public.verificar_duplicidade_material_relacionado()
RETURNS trigger AS
$$
DECLARE
  alvo uuid;
BEGIN
  alvo := COALESCE(NEW.material_id, OLD.material_id);
  IF alvo IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public.atualizar_hashes_material(alvo);

  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> alvo AND m.hash_completo = (SELECT hash_completo FROM public.materiais WHERE id = alvo)
  ) THEN
    RAISE EXCEPTION 'Material duplicado com mesmas cores/características, valor e CA.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> alvo AND m.hash_base = (SELECT hash_base FROM public.materiais WHERE id = alvo)
  ) THEN
    RAISE EXCEPTION 'Material duplicado (mesmo fabricante/grupo/item/número específico).';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS impedir_material_duplicado_cor ON public.material_grupo_cor;
CREATE TRIGGER impedir_material_duplicado_cor
AFTER INSERT OR UPDATE OR DELETE ON public.material_grupo_cor
FOR EACH ROW
EXECUTE FUNCTION public.verificar_duplicidade_material_relacionado();

DROP TRIGGER IF EXISTS impedir_material_duplicado_caracteristica ON public.material_grupo_caracteristica_epi;
CREATE TRIGGER impedir_material_duplicado_caracteristica
AFTER INSERT OR UPDATE OR DELETE ON public.material_grupo_caracteristica_epi
FOR EACH ROW
EXECUTE FUNCTION public.verificar_duplicidade_material_relacionado();

-- Atualiza hashes existentes
UPDATE public.materiais
SET
  hash_base = public.material_hash_base(id),
  hash_completo = public.material_hash_completo(id);

-- Índices para acelerar busca/checagem
DROP INDEX IF EXISTS materiais_hash_completo_uidx;
CREATE UNIQUE INDEX materiais_hash_completo_uidx ON public.materiais(hash_completo);

DROP INDEX IF EXISTS materiais_hash_base_idx;
CREATE INDEX materiais_hash_base_idx ON public.materiais(hash_base);

-- Atualiza view com hashes e item
DROP VIEW IF EXISTS public.materiais_unicos_view;
CREATE VIEW public.materiais_unicos_view AS
WITH cores_agg AS (
  SELECT
    mgc.material_id,
    ARRAY_AGG(DISTINCT fn_normalize_text(c.cor) ORDER BY fn_normalize_text(c.cor)) AS cores_array,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT fn_normalize_text(c.cor) ORDER BY fn_normalize_text(c.cor)), ';') AS cores_string
  FROM public.material_grupo_cor mgc
  LEFT JOIN public.cor c ON c.id::text = mgc.grupo_material_cor::text
  GROUP BY mgc.material_id
),
caracteristicas_agg AS (
  SELECT
    mgce.material_id,
    ARRAY_AGG(DISTINCT fn_normalize_text(ce.caracteristica_material) ORDER BY fn_normalize_text(ce.caracteristica_material)) AS caracteristicas_array,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT fn_normalize_text(ce.caracteristica_material) ORDER BY fn_normalize_text(ce.caracteristica_material)), ';') AS caracteristicas_string
  FROM public.material_grupo_caracteristica_epi mgce
  LEFT JOIN public.caracteristica_epi ce ON ce.id::text = mgce.grupo_caracteristica_epi::text
  GROUP BY mgce.material_id
)
SELECT
  m.id,
  m.fabricante,
  m."grupoMaterial",
  m."numeroEspecifico",
  m."valorUnitario",
  m.ca,
  public.material_resolve_item_nome(m.id) AS item_nome,
  COALESCE(cores_agg.cores_array, ARRAY[]::text[]) AS cores_array,
  COALESCE(caracteristicas_agg.caracteristicas_array, ARRAY[]::text[]) AS caracteristicas_array,
  m.hash_base,
  m.hash_completo
FROM public.materiais m
LEFT JOIN cores_agg ON cores_agg.material_id = m.id
LEFT JOIN caracteristicas_agg ON caracteristicas_agg.material_id = m.id;
