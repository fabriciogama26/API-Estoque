const splitList = (valor) => {
  if (Array.isArray(valor)) {
    return valor
      .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
      .filter(Boolean)
  }
  if (valor === undefined || valor === null) {
    return []
  }
  return String(valor)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

class Acidente {
  constructor({
    id,
    matricula,
    nome,
    cargo,
    data,
    diasPerdidos,
    diasDebitados,
    hht = null,
    tipo,
    tipos = [],
    agente,
    agentes = [],
    lesao,
    lesoes = [],
    parteLesionada,
    partesLesionadas = [],
    centroServico,
    setor,
    local,
    cid = null,
    cat = null,
    observacao = null,
    criadoEm = new Date().toISOString(),
    atualizadoEm = null,
    registradoPor = null,
    atualizadoPor = null,
  }) {
    this.id = id
    this.matricula = matricula
    this.nome = nome
    this.cargo = cargo
    this.data = data
    this.diasPerdidos = diasPerdidos
    this.diasDebitados = diasDebitados
    this.hht = hht ?? null
    const listaTipos = splitList(tipos.length ? tipos : tipo)
    const listaAgentes = splitList(agentes.length ? agentes : agente)
    this.tipos = listaTipos
    this.tipo = listaTipos[0] ?? (tipo ? String(tipo).trim() : '')
    this.agentes = listaAgentes
    this.agente = listaAgentes[0] ?? (agente ? String(agente).trim() : '')
    const listaLesoes = Array.isArray(lesoes)
      ? lesoes.filter((item) => item && String(item).trim())
      : lesao
      ? [lesao]
      : []
    this.lesoes = listaLesoes
    this.lesao = listaLesoes[0] ?? (lesao ? String(lesao).trim() : '')
    const partes = Array.isArray(partesLesionadas)
      ? partesLesionadas.filter((parte) => parte && String(parte).trim())
      : parteLesionada
      ? [parteLesionada]
      : []
    this.partesLesionadas = partes
    this.parteLesionada = parteLesionada ?? partes[0] ?? ''
    const resolvedCentroServico = centroServico ?? setor ?? ''
    this.centroServico = resolvedCentroServico
    this.setor = resolvedCentroServico
    this.local = local ?? resolvedCentroServico
    this.cid = cid
    this.cat = cat
    this.observacao = observacao
    this.criadoEm = criadoEm
    this.atualizadoEm = atualizadoEm
    this.registradoPor = registradoPor
    this.atualizadoPor = atualizadoPor
  }
}

module.exports = Acidente
