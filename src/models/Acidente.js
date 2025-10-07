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
    setor,
    local,
    cid = null,
    cat = null,
    observacao = null,
    criadoEm = new Date().toISOString(),
    atualizadoEm = null
  }) {
    this.id = id;
    this.matricula = matricula;
    this.nome = nome;
    this.cargo = cargo;
    this.data = data;
    this.diasPerdidos = diasPerdidos;
    this.diasDebitados = diasDebitados;
    this.tipo = tipo;
    this.agente = agente;
    this.lesao = lesao;
    this.parteLesionada = parteLesionada;
    this.setor = setor;
    this.local = local;
    this.cid = cid;
    this.cat = cat;
    this.observacao = observacao;
    this.criadoEm = criadoEm;
    this.atualizadoEm = atualizadoEm;
  }
}

module.exports = Acidente;
