
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const REPORT_TYPE_SEMANAL = "semanal"
const DEFAULT_MATERIAIS_VIEW = "materiais_view"
const CENTRO_ESTOQUE_TABLE = "centros_estoque"
const STORAGE_BUCKET = Deno.env.get("RELATORIO_SEMANAL_BUCKET") || "imports"
const REPORT_TIMEZONE = Deno.env.get("RELATORIO_SEMANAL_TIMEZONE") || "America/Sao_Paulo"
const WEEK_DAYS_MS = 7 * 24 * 60 * 60 * 1000

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const materiaisView = Deno.env.get("MATERIAIS_VIEW") || DEFAULT_MATERIAIS_VIEW

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  },
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const trim = (value: unknown) => {
  if (value === undefined || value === null) return ""
  return String(value).trim()
}

const toDateOnly = (value: Date | string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().split("T")[0]
}

const isUuidValue = (value: unknown) => UUID_REGEX.test(String(value || "").trim())

const normalizeSearchValue = (value: unknown) => {
  if (value === undefined || value === null) return ""
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

const sanitizeCsvValue = (value: unknown) => {
  if (value === undefined || value === null) {
    return ""
  }
  const text = typeof value === "string" ? value : String(value)
  const clean = text.replace(/"/g, '""').replace(/\r?\n/g, " ").trim()
  if (/[;"\n]/.test(clean)) {
    return `"${clean}"`
  }
  return clean
}

const formatCsvNumber = (value: unknown, decimals = 0) => {
  if (value === undefined || value === null || value === "") {
    return ""
  }
  const num = Number(value)
  if (Number.isNaN(num)) {
    return ""
  }
  return num.toFixed(decimals)
}

const formatLocalDate = (value: unknown) => {
  if (!value) return ""
  const date = new Date(value as any)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: REPORT_TIMEZONE,
    dateStyle: "short",
  }).format(date)
}

const formatLocalDateTime = (value: unknown) => {
  if (!value) return ""
  const date = new Date(value as any)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: REPORT_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

const formatDateWithOptionalTime = (value: unknown) => {
  if (!value) return "-"
  const date = new Date(value as any)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  const hasTime = typeof value === "string" && value.includes("T")
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: REPORT_TIMEZONE,
    dateStyle: "short",
    ...(hasTime ? { timeStyle: "short" } : {}),
  })
  return formatter.format(date)
}

const formatDateTimeFullPreserve = (value: unknown) => {
  if (!value) return "-"
  const date = new Date(value as any)
  if (Number.isNaN(date.getTime())) return "-"
  const isUtcIso = typeof value === "string" && value.trim().endsWith("Z")
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    ...(isUtcIso ? { timeZone: "UTC" } : { timeZone: REPORT_TIMEZONE }),
  })
  return formatter.format(date)
}

const isRegistroCancelado = (registro: any = {}) => {
  const statusTexto = (registro.statusNome || registro.status || "").toString().trim().toLowerCase()
  return statusTexto === "cancelado"
}

const formatMaterialSummary = (material: any) => {
  if (!material) return ""
  const isLikelyUuid = (value: unknown) => UUID_REGEX.test(String(value || "").trim())
  const nome =
    [material.materialItemNome, material.nome, material.nomeId, material.id].find(
      (valor) => valor && !isLikelyUuid(valor),
    ) || ""
  const grupo = material.grupoMaterialNome || material.grupoMaterial || ""
  const detalheCandidates = [
    material.numeroCalcadoNome,
    material.numeroCalcado,
    material.numeroVestimentaNome,
    material.numeroVestimenta,
    material.numeroEspecifico,
    material.ca,
    material.corMaterial,
    Array.isArray(material.coresNomes) ? material.coresNomes[0] : "",
  ]
  const detalhe = detalheCandidates.find((valor) => valor && !isLikelyUuid(valor)) || ""
  const corDescricao =
    material.coresTexto ||
    material.corMaterial ||
    (Array.isArray(material.coresNomes) ? material.coresNomes.join(", ") : "")
  const caracteristicaDescricao =
    material.caracteristicasTexto ||
    (Array.isArray(material.caracteristicasNomes) ? material.caracteristicasNomes.join(", ") : "")
  const fabricante =
    material.fabricanteNome ||
    (material.fabricante && !isLikelyUuid(material.fabricante) ? material.fabricante : "") ||
    ""
  const resumo = [nome, grupo, detalhe, corDescricao, caracteristicaDescricao, fabricante]
  const vistos = new Set<string>()
  const partes = resumo.filter((parte) => {
    const texto = (parte || "").toString().trim()
    if (!texto) return false
    const chave = texto.toLowerCase()
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
  return partes.join(" | ")
}

const execute = async (builder: any, fallbackMessage: string) => {
  const { data, error } = await builder
  if (error) {
    throw new Error(`${fallbackMessage} ${error.message}`)
  }
  return data
}

const executeSingle = async (builder: any, fallbackMessage: string) => {
  const { data, error } = await builder.single()
  if (error) {
    throw new Error(`${fallbackMessage} ${error.message}`)
  }
  return data
}

const mapEntradaRecord = (record: Record<string, unknown>) => {
  if (!record || typeof record !== "object") {
    return record as any
  }
  const centroEstoqueValor =
    (record as any).centroEstoque ?? (record as any).centro_estoque ?? (record as any).centroCusto ?? null
  const centroCustoRaw = (record as any).centroCusto ?? ""
  const centroCustoId =
    typeof centroEstoqueValor === "string" && UUID_REGEX.test(String(centroEstoqueValor).trim())
      ? String(centroEstoqueValor).trim()
      : null
  const centroCustoNome =
    trim(
      (record as any).centroCustoNome ??
        (record as any).centro_estoque_nome ??
        (record as any).centroEstoqueNome ??
        "",
    ) || (centroCustoId ? "" : trim(centroCustoRaw))
  const usuarioRaw = (record as any).usuarioResponsavel ?? (record as any).usuario_responsavel ?? ""
  const usuarioId = typeof usuarioRaw === "string" && UUID_REGEX.test(usuarioRaw.trim()) ? usuarioRaw.trim() : null
  const usuarioTexto = trim(usuarioRaw)
  return {
    ...record,
    centroCustoId: centroCustoId ?? null,
    centroCusto: centroCustoNome || centroCustoRaw || "",
    usuarioResponsavelId: usuarioId,
    usuarioResponsavel: usuarioId ? usuarioId : usuarioTexto,
    usuarioResponsavelNome: usuarioId ? "" : usuarioTexto,
  }
}

const mapSaidaRecord = (record: Record<string, unknown>) => {
  if (!record || typeof record !== "object") {
    return record as any
  }
  const centroCustoId = (record as any).centroCustoId ?? (record as any).centro_custo ?? null
  const centroServicoId = (record as any).centroServicoId ?? (record as any).centro_servico ?? null
  const centroEstoqueId = (record as any).centroEstoqueId ?? (record as any).centro_estoque ?? null
  const usuarioRaw = (record as any).usuarioResponsavel ?? (record as any).usuario_responsavel ?? ""
  const usuarioId = typeof usuarioRaw === "string" && UUID_REGEX.test(usuarioRaw.trim()) ? usuarioRaw.trim() : null
  const usuarioTexto = trim(usuarioRaw)
  return {
    ...record,
    centroCustoId: centroCustoId ?? null,
    centroServicoId: centroServicoId ?? null,
    centroEstoqueId: centroEstoqueId ?? null,
    centroCusto: (record as any).centroCusto ?? "",
    centroServico: (record as any).centroServico ?? "",
    usuarioResponsavelId: usuarioId,
    usuarioResponsavel: usuarioId ? usuarioId : usuarioTexto,
    usuarioResponsavelNome: usuarioId ? "" : usuarioTexto,
  }
}

const preencherUsuariosResponsaveis = async (registros: any[] = []) => {
  const ids = Array.from(new Set((registros ?? []).map((item) => item?.usuarioResponsavelId).filter(Boolean)))
  if (!ids.length) {
    return registros.map((item) => ({
      ...item,
      usuarioResponsavel:
        item?.usuarioResponsavel && !UUID_REGEX.test(item.usuarioResponsavel)
          ? item.usuarioResponsavel
          : item?.usuarioResponsavel || "",
      usuarioResponsavelNome:
        item?.usuarioResponsavel && !UUID_REGEX.test(item.usuarioResponsavel)
          ? item.usuarioResponsavel
          : "",
    }))
  }
  const usuarios = await execute(
    supabaseAdmin.from("app_users").select("id, display_name, username, email").in("id", ids),
    "Falha ao consultar usuarios.",
  )
  const mapa = new Map(
    (usuarios ?? []).map((usuario: any) => [
      usuario.id,
      trim(usuario.display_name ?? usuario.username ?? usuario.email ?? ""),
    ]),
  )

  return registros.map((item) => {
    const nome = item?.usuarioResponsavelId && mapa.has(item.usuarioResponsavelId)
      ? mapa.get(item.usuarioResponsavelId)
      : item?.usuarioResponsavel
    return {
      ...item,
      usuarioResponsavel: nome || item?.usuarioResponsavel || "",
      usuarioResponsavelNome: nome || item?.usuarioResponsavel || "",
    }
  })
}

const preencherCentrosEstoque = async (registros: any[] = [], ownerId: string) => {
  const ids = Array.from(
    new Set(
      (registros ?? [])
        .map((entrada) => entrada.centroCustoId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor))),
    ),
  )
  if (!ids.length) {
    return registros
  }
  try {
    const centros = await execute(
      supabaseAdmin
        .from(CENTRO_ESTOQUE_TABLE)
        .select("id, almox")
        .in("id", ids)
        .eq("account_owner_id", ownerId),
      "Falha ao consultar centros de estoque.",
    )
    const mapa = new Map(
      (centros ?? [])
        .map((centro: any) => [centro.id, trim(centro.almox ?? "")])
        .filter(([, nome]) => Boolean(nome)),
    )
    if (!mapa.size) {
      return registros
    }
    return registros.map((entrada) => {
      if (!entrada?.centroCustoId) {
        return entrada
      }
      const nome = mapa.get(entrada.centroCustoId)
      if (!nome) {
        return entrada
      }
      return {
        ...entrada,
        centroCusto: nome,
        centroCustoNome: nome,
      }
    })
  } catch (error) {
    console.warn("Falha ao resolver centros de estoque.", error)
    return registros
  }
}

const preencherNomesSaidas = async (registros: any[] = [], ownerId: string) => {
  const centroCustoIds = Array.from(
    new Set(
      registros
        .map((saida) => saida?.centroCustoId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor))),
    ),
  )
  const centroServicoIds = Array.from(
    new Set(
      registros
        .map((saida) => saida?.centroServicoId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor))),
    ),
  )
  const setorIds = Array.from(
    new Set(
      registros
        .map((saida) => saida?.setorId)
        .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor))),
    ),
  )

  const [centrosCusto, centrosServico, setores] = await Promise.all([
    centroCustoIds.length
      ? execute(
          supabaseAdmin
            .from("centros_custo")
            .select("id, nome")
            .in("id", centroCustoIds)
            .eq("account_owner_id", ownerId),
          "Falha ao consultar centros de custo.",
        )
      : [],
    centroServicoIds.length
      ? execute(
          supabaseAdmin
            .from("centros_servico")
            .select("id, nome")
            .in("id", centroServicoIds)
            .eq("account_owner_id", ownerId),
          "Falha ao consultar centros de servico.",
        )
      : [],
    setorIds.length
      ? execute(
          supabaseAdmin
            .from("setores")
            .select("id, nome")
            .in("id", setorIds)
            .eq("account_owner_id", ownerId),
          "Falha ao consultar setores.",
        )
      : [],
  ])

  const centroCustoMap = new Map(
    (centrosCusto ?? []).map((item: any) => [item.id, trim(item.nome ?? "")]).filter(([, nome]) => Boolean(nome)),
  )
  const centroServicoMap = new Map(
    (centrosServico ?? []).map((item: any) => [item.id, trim(item.nome ?? "")]).filter(([, nome]) => Boolean(nome)),
  )
  const setorMap = new Map(
    (setores ?? []).map((item: any) => [item.id, trim(item.nome ?? "")]).filter(([, nome]) => Boolean(nome)),
  )

  return registros.map((saida) => ({
    ...saida,
    centroCusto: centroCustoMap.get(saida?.centroCustoId) || saida?.centroCusto || "",
    centroServico: centroServicoMap.get(saida?.centroServicoId) || saida?.centroServico || "",
    setor: setorMap.get(saida?.setorId) || saida?.setor || "",
  }))
}

const carregarMateriaisPorOwner = async (ownerId: string) => {
  const registrosIds = await execute(
    supabaseAdmin.from("materiais").select("id").eq("account_owner_id", ownerId),
    "Falha ao listar materiais.",
  )
  const ids = (registrosIds ?? []).map((item: any) => item.id).filter(Boolean)
  if (!ids.length) {
    return []
  }
  const materiaisRegistros = await execute(
    supabaseAdmin.from(materiaisView).select("*").in("id", ids).order("nome"),
    "Falha ao listar materiais.",
  )
  return materiaisRegistros ?? []
}

const carregarCentrosEstoqueMap = async (ownerId: string, ids: string[]) => {
  if (!ids.length) return new Map()
  const centros = await execute(
    supabaseAdmin
      .from(CENTRO_ESTOQUE_TABLE)
      .select("id, almox")
      .in("id", ids)
      .eq("account_owner_id", ownerId),
    "Falha ao consultar centros de estoque.",
  )
  return new Map(
    (centros ?? []).map((item: any) => [item.id, trim(item.almox ?? "")]).filter(([, nome]) => Boolean(nome)),
  )
}

const loadStatusEntradaMap = async () => {
  const registros = await execute(
    supabaseAdmin.from("status_entrada").select("id, status").eq("ativo", true),
    "Falha ao consultar status de entrada.",
  )
  const mapa = new Map<string, string>()
  ;(registros ?? []).forEach((registro: any) => {
    if (!registro?.id) return
    const nome = trim(registro.status ?? "")
    if (nome) mapa.set(registro.id, nome)
  })
  return mapa
}

const loadStatusSaidaMap = async () => {
  const registros = await execute(
    supabaseAdmin.from("status_saida").select("id, status"),
    "Falha ao consultar status de saida.",
  )
  const mapa = new Map<string, string>()
  ;(registros ?? []).forEach((registro: any) => {
    if (!registro?.id) return
    const nome = trim(registro.status ?? "")
    if (nome) mapa.set(registro.id, nome)
  })
  return mapa
}

const preencherStatusEntrada = (registros: any[] = [], statusMap: Map<string, string>) => {
  if (!statusMap || statusMap.size === 0) return registros
  return (registros ?? []).map((entrada) => {
    if (!entrada) return entrada
    const lookupId =
      (entrada.statusId && isUuidValue(entrada.statusId) ? entrada.statusId : null) ||
      (entrada.status && isUuidValue(entrada.status) ? entrada.status : null)
    if (!lookupId) return entrada
    const label = statusMap.get(lookupId) || entrada.status
    return {
      ...entrada,
      statusId: lookupId,
      status: label || lookupId,
      statusNome: label || lookupId,
    }
  })
}

const preencherStatusSaida = (registros: any[] = [], statusMap: Map<string, string>) => {
  if (!statusMap || statusMap.size === 0) return registros
  return (registros ?? []).map((saida) => {
    if (!saida) return saida
    const lookupId =
      (saida.statusId && isUuidValue(saida.statusId) ? saida.statusId : null) ||
      (saida.status && isUuidValue(saida.status) ? saida.status : null)
    if (!lookupId) return saida
    const label = statusMap.get(lookupId) || saida.status
    return {
      ...saida,
      statusId: lookupId,
      status: label || lookupId,
      statusNome: label || lookupId,
    }
  })
}

const montarEstoqueAtual = (
  materiais: any[] = [],
  entradas: any[] = [],
  saidas: any[] = [],
  options: any = {},
) => {
  const includeAll = Boolean(options?.includeAll)
  const movementMaterialIds =
    options?.movementMaterialIds instanceof Set ? options.movementMaterialIds : null
  const entradasSaldo = Array.isArray(entradas) ? entradas : []
  const saidasSaldo = Array.isArray(saidas) ? saidas : []
  const entradasPeriodo = Array.isArray(options?.entradasPeriodo) ? options.entradasPeriodo : entradasSaldo
  const saidasPeriodo = Array.isArray(options?.saidasPeriodo) ? options.saidasPeriodo : saidasSaldo
  const materiaisNormalizados = (materiais ?? []).map((material) => {
    if (!material) return null
    return {
      ...material,
      estoqueMinimo: material.estoqueMinimo !== undefined && material.estoqueMinimo !== null
        ? Number(material.estoqueMinimo)
        : null,
      valorUnitario: Number(material.valorUnitario ?? 0),
      validadeDias: material.validadeDias !== undefined ? Number(material.validadeDias) : null,
    }
  }).filter(Boolean)
  const materiaisComMovimentacao = movementMaterialIds ? new Set<string>(movementMaterialIds) : new Set<string>()

  const itens = materiaisNormalizados.map((material: any) => {
    const entradasMaterial = (entradasSaldo ?? [])
      .filter((entrada) => entrada.materialId === material.id)
      .filter((entrada) => !isRegistroCancelado(entrada))
    const saidasMaterial = (saidasSaldo ?? [])
      .filter((saida) => saida.materialId === material.id)
      .filter((saida) => !isRegistroCancelado(saida))
    const entradasPeriodoMaterial = (entradasPeriodo ?? [])
      .filter((entrada) => entrada.materialId === material.id)
      .filter((entrada) => !isRegistroCancelado(entrada))
    const saidasPeriodoMaterial = (saidasPeriodo ?? [])
      .filter((saida) => saida.materialId === material.id)
      .filter((saida) => !isRegistroCancelado(saida))

    const totalEntradas = entradasPeriodoMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
    const totalSaidas = saidasPeriodoMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
    const saldo =
      entradasMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0) -
      saidasMaterial.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
    const estoqueMinimo = Number(material.estoqueMinimo ?? 0)
    const deficitQuantidade = Math.max(estoqueMinimo - saldo, 0)
    const valorReposicao = Number((deficitQuantidade * Number(material.valorUnitario ?? 0)).toFixed(2))

    if (!movementMaterialIds && (saldo !== 0 || entradasMaterial.length > 0)) {
      materiaisComMovimentacao.add(material.id)
    }

    const centrosCustoSet = new Set<string>()
    entradasMaterial.forEach((entrada) => {
      if (entrada?.centroCusto) {
        centrosCustoSet.add(String(entrada.centroCusto).trim())
      }
    })

    const ultimaAtualizacaoDate = [
      ...entradasMaterial.map((item) => item.dataEntrada),
      ...saidasMaterial.map((item) => item.dataEntrega),
    ]
      .map((raw) => {
        const data = new Date(raw)
        return Number.isNaN(data.getTime()) ? null : data
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.getTime() - a.getTime())[0] || null

    const ultimaSaidaInfo =
      saidasMaterial
        .map((saida) => {
          const dataEntregaDate = new Date(saida.dataEntrega ?? saida.data_entrega ?? null)
          if (Number.isNaN(dataEntregaDate.getTime())) {
            return null
          }
          return {
            dataEntrega: dataEntregaDate.toISOString(),
            dataEntregaValue: dataEntregaDate.getTime(),
          }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.dataEntregaValue - a.dataEntregaValue)[0] || null

    let ultimaSaida = null
    if (ultimaSaidaInfo) {
      // remove campo auxiliar de ordenacao
      // eslint-disable-next-line no-unused-vars
      const { dataEntregaValue, ...rest } = ultimaSaidaInfo
      ultimaSaida = rest
    }

    return {
      materialId: material.id,
      nome: material.nome,
      resumo: formatMaterialSummary(material) || material.nome || "",
      fabricante: material.fabricante,
      fabricanteNome: material.fabricanteNome || material.fabricante || "",
      corMaterial: material.corMaterial || material.coresTexto || "",
      coresTexto: material.coresTexto || "",
      validadeDias: material.validadeDias,
      ca: material.ca,
      valorUnitario: material.valorUnitario,
      quantidade: saldo,
      estoqueAtual: saldo,
      valorTotal: Number((saldo * material.valorUnitario).toFixed(2)),
      estoqueMinimo,
      deficitQuantidade,
      valorReposicao,
      alerta: deficitQuantidade > 0,
      centrosCusto: Array.from(centrosCustoSet).filter(Boolean),
      totalEntradas,
      totalSaidas,
      ultimaAtualizacao: ultimaAtualizacaoDate ? ultimaAtualizacaoDate.toISOString() : null,
      ultimaSaida,
    }
  })

  const itensFiltrados = includeAll ? itens : itens.filter((item) => materiaisComMovimentacao.has(item.materialId))
  const alertas = itensFiltrados.filter((item) => item.alerta).map((item) => ({
    materialId: item.materialId,
    nome: item.nome,
    resumo: item.resumo,
    quantidade: item.quantidade,
    estoqueMinimo: item.estoqueMinimo,
    deficitQuantidade: item.deficitQuantidade,
  }))

  return { itens: itensFiltrados, alertas }
}

const buildEntradasCsv = (entradas: any[] = [], context: any = {}) => {
  const materiaisMap = context.materiaisMap instanceof Map ? context.materiaisMap : new Map()
  const centrosCustoMap = context.centrosCustoMap instanceof Map ? context.centrosCustoMap : new Map()

  const headers = [
    "ID",
    "Centro de estoque",
    "Material",
    "Descricao",
    "Quantidade",
    "Status",
    "Registrado por",
    "Cadastrado em",
  ]

  const resolveCentroCustoLabel = (entrada: any) => {
    if (!entrada) {
      return ""
    }
    const candidatos = [entrada.centroCustoId, entrada.centroCusto]
    for (const raw of candidatos) {
      if (!raw) continue
      const texto = raw.toString().trim()
      if (!texto) continue
      const label =
        centrosCustoMap.get(raw) ||
        centrosCustoMap.get(texto) ||
        centrosCustoMap.get(normalizeSearchValue(texto))
      if (label) {
        return label
      }
    }
    return entrada.centroCusto || entrada.centroCustoId || ""
  }

  const rows = (Array.isArray(entradas) ? entradas : []).map((entrada) => {
    const material = materiaisMap.get(entrada?.materialId) || null
    const valores = [
      entrada?.id ?? "",
      resolveCentroCustoLabel(entrada),
      formatMaterialSummary(material) || material?.nome || entrada?.materialId || "",
      material?.descricao || "",
      entrada?.quantidade ?? "",
      entrada?.statusNome ?? entrada?.status ?? "",
      entrada?.usuarioResponsavelNome || entrada?.usuarioResponsavel || entrada?.usuarioResponsavelId || "",
      formatLocalDateTime(
        entrada?.criadoEm ||
          entrada?.created_at ||
          entrada?.create_at ||
          entrada?.createdAt ||
          entrada?.dataEntrada ||
          entrada?.data_entrada ||
          "",
      ),
    ]
    return valores.map(sanitizeCsvValue).join(";")
  })

  return ["sep=;", headers.join(";"), ...rows].join("\n")
}

const buildSaidasCsv = (saidas: any[] = [], context: any = {}) => {
  const pessoasMap = context.pessoasMap instanceof Map ? context.pessoasMap : new Map()
  const materiaisMap = context.materiaisMap instanceof Map ? context.materiaisMap : new Map()
  const centrosEstoqueMap = context.centrosEstoqueMap instanceof Map ? context.centrosEstoqueMap : new Map()

  const headers = [
    "ID",
    "Pessoa",
    "Matricula",
    "Material",
    "Quantidade",
    "Centro de estoque",
    "Centro de custo",
    "Centro de servico",
    "Data entrega",
    "Data troca",
    "Status",
    "Registrado por",
    "Cadastrado em",
  ]

  const resolveRegistradoPor = (saida: any) =>
    saida?.usuarioResponsavelNome || saida?.usuarioResponsavelUsername || saida?.usuarioResponsavel || ""

  const rows = (Array.isArray(saidas) ? saidas : []).map((saida) => {
    const pessoa = pessoasMap.get(saida?.pessoaId) || null
    const material = materiaisMap.get(saida?.materialId) || null
    const valores = [
      saida?.id ?? "",
      pessoa?.nome ?? saida?.pessoaId ?? "",
      pessoa?.matricula ?? "",
      formatMaterialSummary(material) || material?.nome || saida?.materialId || "",
      saida?.quantidade ?? "",
      centrosEstoqueMap.get(saida?.centroEstoqueId) || saida?.centroEstoque || saida?.centroEstoqueId || "",
      saida?.centroCusto ?? saida?.centroCustoId ?? "",
      saida?.centroServico ?? saida?.centroServicoId ?? "",
      formatLocalDateTime(saida?.dataEntrega),
      formatLocalDate(saida?.dataTroca),
      saida?.statusNome ?? saida?.status ?? "",
      resolveRegistradoPor(saida),
      formatLocalDateTime(saida?.criadoEm || saida?.created_at),
    ]
    return valores.map(sanitizeCsvValue).join(";")
  })

  return ["sep=;", headers.join(";"), ...rows].join("\n")
}

const buildAcidentesCsv = (acidentes: any[] = []) => {
  const headers = [
    "Nome",
    "Matricula",
    "Status",
    "Data",
    "Centro de servico",
    "Local",
    "CAT",
    "CID",
    "Registrado por",
    "Cadastrado em",
  ]

  const rows = (Array.isArray(acidentes) ? acidentes : []).map((acidente) => {
    const status = acidente?.ativo === false ? "Cancelado" : "Ativo"
    const centroServico = acidente?.centro_servico || acidente?.setor || ""
    const registradoPor =
      acidente?.registrado_por_nome ?? acidente?.registrado_por ?? acidente?.usuarioCadastroNome ?? acidente?.usuarioCadastro ?? ""
    const criadoEm = acidente?.criado_em ?? acidente?.created_at ?? acidente?.createdAt ?? ""

    const valores = [
      acidente?.nome ?? "",
      acidente?.matricula ?? "",
      status,
      formatDateWithOptionalTime(acidente?.data),
      centroServico,
      acidente?.local ?? "",
      acidente?.cat ?? "",
      acidente?.cid ?? "",
      registradoPor,
      formatDateTimeFullPreserve(criadoEm),
    ]
    return valores.map(sanitizeCsvValue).join(";")
  })

  return [headers.join(";"), ...rows].join("\n")
}

const buildHhtCsv = (registros: any[] = []) => {
  const headers = [
    "ID",
    "Mes referencia",
    "Centro de servico",
    "Status",
    "Qtd pessoas",
    "Horas base",
    "Escala",
    "Horas afastamento",
    "Horas ferias",
    "Horas treinamento",
    "Horas outros",
    "Horas extras",
    "Modo",
    "HHT informado",
    "HHT calculado",
    "HHT final",
    "Criado em",
    "Criado por",
    "Atualizado em",
    "Atualizado por",
  ]

  const rows = (Array.isArray(registros) ? registros : []).map((item) => {
    const valores = [
      item?.id ?? "",
      item?.mes_ref ?? "",
      item?.centro_servico_nome ?? "",
      item?.status_nome ?? "",
      item?.qtd_pessoas ?? "",
      item?.horas_mes_base ?? "",
      item?.escala_factor ?? "",
      item?.horas_afastamento ?? "",
      item?.horas_ferias ?? "",
      item?.horas_treinamento ?? "",
      item?.horas_outros_descontos ?? "",
      item?.horas_extras ?? "",
      item?.modo ?? "",
      item?.hht_informado ?? "",
      item?.hht_calculado ?? "",
      item?.hht_final ?? "",
      formatLocalDateTime(item?.created_at),
      item?.created_by_name || item?.created_by_username || item?.created_by || "",
      formatLocalDateTime(item?.updated_at),
      item?.updated_by_name || item?.updated_by_username || item?.updated_by || "",
    ]
    return valores.map(sanitizeCsvValue).join(";")
  })

  return ["sep=;", headers.join(";"), ...rows].join("\n")
}

const buildEstoqueCsv = (itens: any[] = []) => {
  const headers = [
    "Material ID",
    "Material",
    "Fabricante",
    "CA",
    "Cor",
    "Validade (dias)",
    "Centros de estoque",
    "Quantidade em estoque",
    "Total de entradas",
    "Total de saidas",
    "Estoque minimo",
    "Deficit",
    "Valor unitario",
    "Valor total",
    "Valor para reposicao",
    "Ultima atualizacao",
    "Ultima saida (data)",
  ]

  const rows = (Array.isArray(itens) ? itens : []).map((item) => {
    const ultimaSaidaData = item?.ultimaSaida?.dataEntrega ?? null
    const valores = [
      item?.materialId,
      item?.resumo || item?.nome || "",
      item?.fabricanteNome || item?.fabricante || "",
      item?.ca || "",
      item?.corMaterial || item?.coresTexto || "",
      item?.validadeDias ?? "",
      Array.isArray(item?.centrosCusto) ? item.centrosCusto.join(", ") : "",
      formatCsvNumber(item?.quantidade ?? item?.estoqueAtual ?? 0),
      formatCsvNumber(item?.totalEntradas ?? 0),
      formatCsvNumber(item?.totalSaidas ?? 0),
      formatCsvNumber(item?.estoqueMinimo ?? 0),
      formatCsvNumber(item?.deficitQuantidade ?? 0),
      formatCsvNumber(item?.valorUnitario ?? 0, 2),
      formatCsvNumber(item?.valorTotal ?? 0, 2),
      formatCsvNumber(item?.valorReposicao ?? 0, 2),
      formatLocalDateTime(item?.ultimaAtualizacao),
      formatLocalDateTime(ultimaSaidaData),
    ]
    return valores.map(sanitizeCsvValue).join(";")
  })

  return [headers.join(";"), ...rows].join("\n")
}

const uploadCsv = async ({
  ownerId,
  periodKey,
  name,
  content,
}: {
  ownerId: string
  periodKey: string
  name: string
  content: string
}) => {
  const path = `relatorios-semanais/${ownerId}/${periodKey}/${name}`
  const encoder = new TextEncoder()
  const payload = encoder.encode(content)
  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, payload, {
    contentType: "text/csv",
    upsert: true,
  })
  if (error) {
    throw new Error(`Falha ao enviar CSV ${name}: ${error.message}`)
  }
  return {
    path,
    filename: name,
    bucket: STORAGE_BUCKET,
    content_type: "text/csv",
    size_bytes: payload.byteLength,
  }
}

const loadReportRegistry = async (ownerId: string) => {
  const registros = await execute(
    supabaseAdmin
      .from("inventory_report")
      .select("periodo_inicio, periodo_fim")
      .eq("account_owner_id", ownerId)
      .eq("metadados->>tipo", REPORT_TYPE_SEMANAL),
    "Falha ao consultar relatorios semanais.",
  )
  const set = new Set<string>()
  registros?.forEach((item: any) => {
    const key = `${item?.periodo_inicio || ""}|${item?.periodo_fim || ""}`
    if (key !== "|") {
      set.add(key)
    }
  })
  return set
}

const resolveWeekRange = (base: Date) => {
  const end = new Date(base.getTime())
  const start = new Date(base.getTime() - WEEK_DAYS_MS)
  return { start, end }
}

const filtrarPorRange = (lista: any[] = [], campoData: string, range: { start: Date; end: Date }) => {
  if (!range?.start || !range?.end) return lista
  return (lista ?? []).filter((item: any) => {
    const raw = item?.[campoData]
    if (!raw) return false
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return false
    return date >= range.start && date <= range.end
  })
}

const carregarAcidentesPorOwner = async (ownerId: string, range: { start: Date; end: Date }) => {
  return await execute(
    supabaseAdmin
      .from("vw_acidentes")
      .select("*")
      .eq("account_owner_id", ownerId)
      .gte("criado_em", range.start.toISOString())
      .lte("criado_em", range.end.toISOString())
      .order("criado_em", { ascending: false }),
    "Falha ao listar acidentes.",
  )
}

const carregarHhtPorOwner = async (ownerId: string, range: { start: Date; end: Date }) => {
  const registrosIds = await execute(
    supabaseAdmin
      .from("hht_mensal")
      .select("id")
      .eq("account_owner_id", ownerId)
      .gte("created_at", range.start.toISOString())
      .lte("created_at", range.end.toISOString()),
    "Falha ao listar HHT mensal.",
  )
  const ids = (registrosIds ?? []).map((item: any) => item.id).filter(Boolean)
  if (!ids.length) return []
  return await execute(
    supabaseAdmin
      .from("hht_mensal_view")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false }),
    "Falha ao listar HHT mensal.",
  )
}

const carregarMovimentacoesPorOwner = async (ownerId: string, range: { start: Date; end: Date }) => {
  const entradasQuery = supabaseAdmin.from("entradas").select("*").eq("account_owner_id", ownerId)
  const saidasQuery = supabaseAdmin.from("saidas").select("*").eq("account_owner_id", ownerId)

  const [materiais, entradasRaw, saidasRaw, pessoas] = await Promise.all([
    carregarMateriaisPorOwner(ownerId),
    execute(entradasQuery, "Falha ao listar entradas."),
    execute(saidasQuery, "Falha ao listar saidas."),
    execute(
      supabaseAdmin
        .from("pessoas")
        .select("id, nome, matricula")
        .eq("account_owner_id", ownerId),
      "Falha ao listar pessoas.",
    ),
  ])

  let entradas = (entradasRaw ?? []).map(mapEntradaRecord)
  let saidas = (saidasRaw ?? []).map(mapSaidaRecord)

  entradas = await preencherUsuariosResponsaveis(entradas)
  saidas = await preencherUsuariosResponsaveis(saidas)

  entradas = await preencherCentrosEstoque(entradas, ownerId)
  saidas = await preencherNomesSaidas(saidas, ownerId)

  const [statusEntradaMap, statusSaidaMap] = await Promise.all([
    loadStatusEntradaMap(),
    loadStatusSaidaMap(),
  ])
  entradas = preencherStatusEntrada(entradas, statusEntradaMap)
  saidas = preencherStatusSaida(saidas, statusSaidaMap)

  const entradasSemana = filtrarPorRange(entradas, "dataEntrada", range)
  const saidasSemana = filtrarPorRange(saidas, "dataEntrega", range)

  return {
    materiais,
    entradasSemana,
    saidasSemana,
    entradasTodas: entradas,
    saidasTodas: saidas,
    pessoas: pessoas ?? [],
  }
}

export const assertRelatorioSemanalEnv = () => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
}

export const runRelatorioEstoqueSemanal = async () => {
  assertRelatorioSemanalEnv()
  const owners = await execute(
    supabaseAdmin
      .from("app_users")
      .select("id, email, username, display_name, ativo, parent_user_id")
      .is("parent_user_id", null),
    "Falha ao listar owners.",
  )

  const base = new Date()
  const range = resolveWeekRange(base)
  const periodoInicio = toDateOnly(range.start)
  const periodoFim = toDateOnly(range.end)
  const periodKey = `${periodoInicio}_a_${periodoFim}`

  const resultados: any[] = []
  for (const owner of owners ?? []) {
    if (owner?.ativo === false) {
      continue
    }
    const ownerId = owner?.id
    if (!ownerId) continue

    const semanalRegistrados = await loadReportRegistry(ownerId)
    const chave = `${periodoInicio}|${periodoFim}`
    if (semanalRegistrados.has(chave)) {
      resultados.push({ ownerId, skipped: true, reason: "periodo_ja_registrado" })
      continue
    }

    const [{
      materiais,
      entradasSemana,
      saidasSemana,
      entradasTodas,
      saidasTodas,
      pessoas,
    }, acidentes, hhtRegistros] = await Promise.all([
      carregarMovimentacoesPorOwner(ownerId, range),
      carregarAcidentesPorOwner(ownerId, range),
      carregarHhtPorOwner(ownerId, range),
    ])

    const movementMaterialIds = new Set(
      [...(entradasSemana ?? []), ...(saidasSemana ?? [])]
        .filter((item: any) => item?.materialId && !isRegistroCancelado(item))
        .map((item: any) => item.materialId),
    )

    const estoqueBase = montarEstoqueAtual(materiais, entradasTodas, saidasTodas, {
      includeAll: false,
      movementMaterialIds,
      entradasPeriodo: entradasSemana,
      saidasPeriodo: saidasSemana,
    })

    const materiaisMap = new Map((materiais ?? []).map((item: any) => [item.id, item]))
    const pessoasMap = new Map((pessoas ?? []).map((item: any) => [item.id, item]))

    const centroEstoqueIds = Array.from(
      new Set(
        [...(entradasSemana ?? []), ...(saidasSemana ?? [])]
          .map((item: any) => item?.centroCustoId ?? item?.centroEstoqueId)
          .filter((valor) => Boolean(valor) && UUID_REGEX.test(String(valor))),
      ),
    )
    const centrosEstoqueMap = await carregarCentrosEstoqueMap(ownerId, centroEstoqueIds)

    const entradasCsv = buildEntradasCsv(entradasSemana, { materiaisMap, centrosCustoMap: centrosEstoqueMap })
    const saidasCsv = buildSaidasCsv(saidasSemana, { pessoasMap, materiaisMap, centrosEstoqueMap })
    const acidentesCsv = buildAcidentesCsv(acidentes)
    const hhtCsv = buildHhtCsv(hhtRegistros)
    const estoqueCsv = buildEstoqueCsv(estoqueBase.itens)

    const attachments = []
    attachments.push(
      await uploadCsv({ ownerId, periodKey, name: `entradas-${periodKey}.csv`, content: `\ufeff${entradasCsv}` }),
    )
    attachments.push(
      await uploadCsv({ ownerId, periodKey, name: `saidas-${periodKey}.csv`, content: `\ufeff${saidasCsv}` }),
    )
    attachments.push(
      await uploadCsv({ ownerId, periodKey, name: `acidentes-${periodKey}.csv`, content: `\ufeff${acidentesCsv}` }),
    )
    attachments.push(
      await uploadCsv({ ownerId, periodKey, name: `hht-${periodKey}.csv`, content: `\ufeff${hhtCsv}` }),
    )
    attachments.push(
      await uploadCsv({ ownerId, periodKey, name: `estoque-atual-${periodKey}.csv`, content: estoqueCsv }),
    )

    const metadados = {
      tipo: REPORT_TYPE_SEMANAL,
      origem: "auto",
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      periodo_inicio_ts: range.start.toISOString(),
      periodo_fim_ts: range.end.toISOString(),
      timezone: REPORT_TIMEZONE,
      arquivos: attachments,
    }

    const registro = await executeSingle(
      supabaseAdmin
        .from("inventory_report")
        .insert({
          account_owner_id: ownerId,
          created_by: ownerId,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          termo: "",
          pareto_saida: {},
          pareto_risco: {},
          pareto_financeiro: {},
          metadados,
          arquivos_total: attachments.length,
          email_status: "pendente",
          email_enviado_em: null,
          email_erro: null,
          email_tentativas: 0,
        })
        .select("id, created_at"),
      "Falha ao registrar relatorio semanal.",
    )

    resultados.push({
      ownerId,
      reportId: registro?.id ?? null,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      email_status: "pendente",
      attachments: attachments.length,
    })
  }

  return { ok: true, total: resultados.length, resultados }
}
