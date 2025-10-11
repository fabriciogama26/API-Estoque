class Acidente {
  constructor({
    id,
    matricula,
    nome,
    cargo,
    data,
    diasPerdidos,
    diasDebitados,
    tipo,
    agente,
    lesao,
    parteLesionada,
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
    this.tipo = tipo
    this.agente = agente
    this.lesao = lesao
    this.parteLesionada = parteLesionada
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
