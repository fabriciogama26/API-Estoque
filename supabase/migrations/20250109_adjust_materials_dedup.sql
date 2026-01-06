-- Ajusta deduplicacao de materiais (para novos INSERT/UPDATE):
-- hash completo considera (fabricante + grupo + item + numeroEspecifico + CA + cores + caracteristicas)
-- e remove valorUnitario da comparacao. Nao recalcula dados antigos e nao cria indice unico,
-- para evitar quebra em bases ja existentes.

-- Helpers necessarios (redeclara para evitar falta em ambientes onde 0057 ainda nao rodou)
CREATE OR REPLACE FUNCTION public.fn_normalize_text(p_val text)
RETURNS text LANGUAGE sql IMMUTABLE AS
$$
SELECT lower(trim(coalesce(p_val, '')));
$$;

-- Normaliza qualquer tipo para texto (evita erros com uuid/num)
CREATE OR REPLACE FUNCTION public.fn_normalize_any(p_val anyelement)
RETURNS text LANGUAGE sql IMMUTABLE AS
$$
SELECT lower(trim(coalesce(p_val::text, '')));
$$;

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

-- Resolve numero (usa apenas numeroEspecifico)
CREATE OR REPLACE FUNCTION public.material_resolve_numero(p_material_id uuid)
RETURNS text LANGUAGE sql STABLE AS
$$
SELECT COALESCE(
  NULLIF(m."numeroEspecifico"::text, ''),
  m."numeroEspecifico"::text,
  ''
)
FROM public.materiais m
WHERE m.id = p_material_id;
$$;

-- Função: hash camada 1 (fabricante + grupo + item + numeroEspecifico)
CREATE OR REPLACE FUNCTION public.material_hash_base(p_material_id uuid)
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
)
SELECT md5(
  fn_normalize_text(
    CONCAT_WS('|',
      COALESCE(m.fabricante::text, ''),
      COALESCE(m."grupoMaterial"::text, ''),
      COALESCE(public.material_resolve_item_nome(m.id), ''),
      COALESCE(public.material_resolve_numero(m.id), ''),
      COALESCE(cores_agg.cores_string, fn_normalize_text(m.corMaterial), '')
    )
  )
)
FROM public.materiais m
LEFT JOIN cores_agg ON cores_agg.material_id = m.id
WHERE m.id = p_material_id;
$$;

-- Função: hash camada 2 (base + CA + cores + caracteristicas)
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
      COALESCE(public.material_resolve_numero(m.id), ''),
      COALESCE(NULLIF(m.ca, ''), ''),
      COALESCE(cores_agg.cores_string, fn_normalize_text(m.corMaterial), ''),
      COALESCE(caracteristicas_agg.caracteristicas_string, fn_normalize_text(m.caracteristicaEpi), '')
    )
  )
)
FROM public.materiais m
LEFT JOIN cores_agg ON cores_agg.material_id = m.id
LEFT JOIN caracteristicas_agg ON caracteristicas_agg.material_id = m.id
WHERE m.id = p_material_id;
$$;

-- Trigger BEFORE insert/update para setar hashes e validar duplicidade (sem valorUnitario)
CREATE OR REPLACE FUNCTION public.evitar_duplicidade_material()
RETURNS trigger AS
$$
DECLARE
  v_ca_norm text;
  v_grupo_norm text;
  v_nome_norm text;
  v_hash_base text;
  v_hash_completo text;
BEGIN
  v_ca_norm := NULLIF(fn_normalize_any(NEW.ca), '');
  v_grupo_norm := NULLIF(fn_normalize_any(NEW."grupoMaterial"), '');
  v_nome_norm := NULLIF(fn_normalize_any(NEW.nome), '');

  -- Regra: C.A nao pode aparecer em grupo/item diferente
  IF v_ca_norm IS NOT NULL AND v_nome_norm IS NOT NULL AND v_grupo_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.materiais m
    WHERE m.id <> NEW.id
      AND NULLIF(fn_normalize_any(m.ca), '') = v_ca_norm
      AND (
        NULLIF(fn_normalize_any(m."grupoMaterial"), '') IS DISTINCT FROM v_grupo_norm OR
        NULLIF(fn_normalize_any(m.nome), '') IS DISTINCT FROM v_nome_norm
      )
  ) THEN
    RAISE EXCEPTION 'Ja existe C.A associado a outro grupo ou item.';
  END IF;

  v_hash_base := public.material_hash_base(NEW.id);
  v_hash_completo := public.material_hash_completo(NEW.id);

  NEW.hash_base := v_hash_base;
  NEW.hash_completo := v_hash_completo;

  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> NEW.id
      AND public.material_hash_completo(m.id) = v_hash_completo
  ) THEN
    RAISE EXCEPTION 'Material duplicado com mesmas cores/caracteristicas e C.A.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> NEW.id
      AND public.material_hash_base(m.id) = v_hash_base
  ) THEN
    RAISE EXCEPTION 'Material duplicado (mesmo fabricante/grupo/item/numero especifico).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para revalidar apos mudancas em cores/caracteristicas
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
    RAISE EXCEPTION 'Material duplicado com mesmas cores/caracteristicas e C.A.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.id <> alvo AND m.hash_base = (SELECT hash_base FROM public.materiais WHERE id = alvo)
  ) THEN
    RAISE EXCEPTION 'Material duplicado (mesmo fabricante/grupo/item/numero especifico).';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Função auxiliar para recalcular hashes em um material
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

-- Recria trigger principal para garantir uso da funcao atualizada
DROP TRIGGER IF EXISTS impedir_material_duplicado ON public.materiais;
CREATE TRIGGER impedir_material_duplicado
BEFORE INSERT OR UPDATE ON public.materiais
FOR EACH ROW
EXECUTE FUNCTION public.evitar_duplicidade_material();

-- Recria triggers relacionais para garantir uso da funcao atualizada
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

-- Garante colunas de hash
ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS hash_base text,
  ADD COLUMN IF NOT EXISTS hash_completo text;

-- Nao recalcula hashes existentes e nao cria indice unico,
-- para evitar falha em bases com dados legados.
