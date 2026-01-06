-- Torna obrigatórios no banco os campos que são requeridos nas telas.
-- Não inclui campos condicionais (tamanho/numeração) nem CA (continua opcional).

-- 1) Materiais: grupoMaterial deve ser obrigatório.
DO $$
DECLARE
  v_ids text;
BEGIN
  SELECT string_agg(id::text, ', ') INTO v_ids
  FROM public.materiais
  WHERE "grupoMaterial" IS NULL;

  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Nao foi possivel aplicar NOT NULL em grupoMaterial; registros sem grupo: %', v_ids;
  END IF;
END;
$$;

ALTER TABLE public.materiais
  ALTER COLUMN "grupoMaterial" SET NOT NULL;

-- 2) Pessoas: dataAdmissao obrigatória (preenche nulos com criadoEm ou now()).
UPDATE public.pessoas
SET "dataAdmissao" = COALESCE("dataAdmissao", "criadoEm", now())
WHERE "dataAdmissao" IS NULL;

ALTER TABLE public.pessoas
  ALTER COLUMN "dataAdmissao" SET NOT NULL;

-- 3) Entradas: materialId, quantidade, dataEntrada, centro_estoque obrigatórios (falha se houver nulos legados).
DO $$
DECLARE
  v_ids text;
BEGIN
  SELECT string_agg(id::text, ', ') INTO v_ids
  FROM public.entradas
  WHERE "materialId" IS NULL
     OR quantidade IS NULL
     OR "dataEntrada" IS NULL
     OR centro_estoque IS NULL;

  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Nao foi possivel aplicar obrigatoriedade em entradas; registros com nulo: %', v_ids;
  END IF;
END;
$$;

ALTER TABLE public.entradas
  ALTER COLUMN "materialId" SET NOT NULL,
  ALTER COLUMN quantidade SET NOT NULL,
  ALTER COLUMN "dataEntrada" SET NOT NULL,
  ALTER COLUMN centro_estoque SET NOT NULL;

-- 4) Saidas: materialId, pessoaId, quantidade, dataEntrega, centro_custo, centro_servico obrigatórios.
DO $$
DECLARE
  v_ids text;
BEGIN
  SELECT string_agg(id::text, ', ') INTO v_ids
  FROM public.saidas
  WHERE "materialId" IS NULL
     OR "pessoaId" IS NULL
     OR quantidade IS NULL
     OR "dataEntrega" IS NULL
     OR centro_custo IS NULL
     OR centro_servico IS NULL;

  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Nao foi possivel aplicar obrigatoriedade em saidas; registros com nulo: %', v_ids;
  END IF;
END;
$$;

ALTER TABLE public.saidas
  ALTER COLUMN "materialId" SET NOT NULL,
  ALTER COLUMN "pessoaId" SET NOT NULL,
  ALTER COLUMN quantidade SET NOT NULL,
  ALTER COLUMN "dataEntrega" SET NOT NULL,
  ALTER COLUMN centro_custo SET NOT NULL,
  ALTER COLUMN centro_servico SET NOT NULL;

-- 5) Acidentes: campos obrigatórios presentes nas telas (matricula, nome, cargo, data, centro_servico, local, diasPerdidos, diasDebitados, hht).
DO $$
DECLARE
  v_ids text;
BEGIN
  SELECT string_agg(id::text, ', ') INTO v_ids
  FROM public.acidentes
  WHERE matricula IS NULL
     OR nome IS NULL
     OR cargo IS NULL
     OR data IS NULL
     OR centro_servico IS NULL
     OR local IS NULL
     OR "diasPerdidos" IS NULL
     OR "diasDebitados" IS NULL
     OR hht IS NULL;

  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Nao foi possivel aplicar obrigatoriedade em acidentes; registros com nulo: %', v_ids;
  END IF;
END;
$$;

ALTER TABLE public.acidentes
  ALTER COLUMN matricula SET NOT NULL,
  ALTER COLUMN nome SET NOT NULL,
  ALTER COLUMN cargo SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN centro_servico SET NOT NULL,
  ALTER COLUMN local SET NOT NULL,
  ALTER COLUMN "diasPerdidos" SET NOT NULL,
  ALTER COLUMN "diasDebitados" SET NOT NULL,
  ALTER COLUMN hht SET NOT NULL;

-- 6) HHT Mensal: campos obrigatórios (mes_ref, centro_servico_id, qtd_pessoas, horas_mes_base, escala_factor, horas_afastamento, horas_ferias, horas_treinamento).
DO $$
DECLARE
  v_ids text;
BEGIN
  SELECT string_agg(id::text, ', ') INTO v_ids
  FROM public.hht_mensal
  WHERE mes_ref IS NULL
     OR centro_servico_id IS NULL
     OR qtd_pessoas IS NULL
     OR horas_mes_base IS NULL
     OR escala_factor IS NULL
     OR horas_afastamento IS NULL
     OR horas_ferias IS NULL
     OR horas_treinamento IS NULL;

  IF v_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Nao foi possivel aplicar obrigatoriedade em hht_mensal; registros com nulo: %', v_ids;
  END IF;
END;
$$;

ALTER TABLE public.hht_mensal
  ALTER COLUMN mes_ref SET NOT NULL,
  ALTER COLUMN centro_servico_id SET NOT NULL,
  ALTER COLUMN qtd_pessoas SET NOT NULL,
  ALTER COLUMN horas_mes_base SET NOT NULL,
  ALTER COLUMN escala_factor SET NOT NULL,
  ALTER COLUMN horas_afastamento SET NOT NULL,
  ALTER COLUMN horas_ferias SET NOT NULL,
  ALTER COLUMN horas_treinamento SET NOT NULL;
