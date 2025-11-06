import { readState } from '../../src/services/localDataStore.js'

const trim = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

const buildDescricaoMaterial = (material) => {
  if (!material || typeof material !== 'object') {
    return ''
  }
  const partes = [material.nome]
  if (material.fabricante) {
    partes.push(material.fabricante)
  }
  const numeroEspecifico = material.numeroEspecifico || material.numeroCalcado || material.numeroVestimenta
  if (numeroEspecifico) {
    partes.push(numeroEspecifico)
  }
  if (material.caracteristicaEpi) {
    partes.push(material.caracteristicaEpi)
  }
  if (material.corMaterial) {
    partes.push(material.corMaterial)
  }
  return partes.filter(Boolean).join(' ')
}

const resolveEmpresaInfoLocal = () => {
  const env = typeof process !== 'undefined' ? process.env || {} : {}
  const get = (key) => env[key] || env[`VITE_${key}`] || ''
  return {
    nome: get('TERMO_EPI_EMPRESA_NOME'),
    documento: get('TERMO_EPI_EMPRESA_DOCUMENTO'),
    endereco: get('TERMO_EPI_EMPRESA_ENDERECO'),
    contato: get('TERMO_EPI_EMPRESA_CONTATO'),
    logoUrl: get('TERMO_EPI_EMPRESA_LOGO_URL'),
    logoSecundarioUrl: get('TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL'),
  }
}

const createError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const mapLocalPessoaRecord = (pessoa) => {
  if (!pessoa || typeof pessoa !== 'object') {
    return pessoa
  }
  const centroServico = pessoa.centroServico ?? pessoa.local ?? ''
  return {
    ...pessoa,
    centroServico,
    local: pessoa.local ?? centroServico,
  }
}

const mapLocalMaterialResumo = (material) => {
  if (!material || typeof material !== 'object') {
    return null
  }
  return {
    id: material.id,
    nome: material.nome || '',
    fabricante: material.fabricante || '',
    ca: material.ca || '',
    numeroEspecifico: material.numeroEspecifico || '',
    numeroCalcado: material.numeroCalcado || '',
    numeroVestimenta: material.numeroVestimenta || '',
    grupoMaterial: material.grupoMaterial || '',
    caracteristicaEpi: material.caracteristicaEpi || '',
    corMaterial: material.corMaterial || '',
  }
}

const montarContextoTermoEpiLocal = (pessoa, saidasDetalhadas) => {
  const entregasOrdenadas = saidasDetalhadas
    .slice()
    .sort((a, b) => {
      const aTime = a.dataEntrega ? new Date(a.dataEntrega).getTime() : 0
      const bTime = b.dataEntrega ? new Date(b.dataEntrega).getTime() : 0
      return aTime - bTime
    })

  const entregas = entregasOrdenadas.map((saida, index) => {
    const quantidade = Number(saida.quantidade ?? 0)
    const numeroCa = saida.material?.ca || ''
    return {
      ordem: index + 1,
      id: saida.id,
      dataEntrega: saida.dataEntrega || null,
      quantidade,
      descricao: buildDescricaoMaterial(saida.material),
      numeroCa,
      centroCusto: saida.centroCusto || '',
      centroServico: saida.centroServico || '',
      status: saida.status || '',
      usuarioResponsavel: saida.usuarioResponsavel || '',
      dataTroca: saida.dataTroca || null,
    }
  })

  const totalItensEntregues = entregas.reduce((acc, entrega) => acc + Number(entrega.quantidade ?? 0), 0)
  const ultimaEntrega =
    entregasOrdenadas.length > 0 ? entregasOrdenadas[entregasOrdenadas.length - 1].dataEntrega || null : null

  return {
    colaborador: {
      id: pessoa.id,
      nome: pessoa.nome || '',
      matricula: pessoa.matricula || '',
      cargo: pessoa.cargo || '',
      centroServico: pessoa.centroServico || pessoa.local || '',
      unidade: pessoa.unidade || pessoa.centroServico || pessoa.local || '',
      dataAdmissao: pessoa.dataAdmissao || null,
      tipoExecucao: pessoa.tipoExecucao || '',
      usuarioCadastro: pessoa.usuarioCadastro || '',
      usuarioEdicao: pessoa.usuarioEdicao || '',
      criadoEm: pessoa.criadoEm || null,
      atualizadoEm: pessoa.atualizadoEm || null,
    },
    entregas,
    totais: {
      quantidadeEntregas: entregas.length,
      totalItensEntregues,
      ultimaEntrega,
    },
  }
}

export function getLocalTermoContext(params = {}) {
  const matriculaParam = trim(params.matricula).toLowerCase()
  const nomeParam = trim(params.nome).toLowerCase()

  if (!matriculaParam && !nomeParam) {
    throw createError(400, 'Informe a matricula ou o nome do colaborador.')
  }

  return readState((state) => {
    const pessoas = Array.isArray(state.pessoas) ? state.pessoas : []
    let pessoa = null

    if (matriculaParam) {
      pessoa =
        pessoas.find(
          (item) => item.matricula && String(item.matricula).trim().toLowerCase() === matriculaParam,
        ) || null
    }

    if (!pessoa && nomeParam) {
      const matching = pessoas.filter((item) =>
        String(item.nome || '').trim().toLowerCase().includes(nomeParam),
      )
      if (matching.length === 0) {
        throw createError(404, 'Colaborador nao encontrado para os dados informados.')
      }
      if (matching.length > 1) {
        throw createError(409, 'Mais de um colaborador encontrado para o nome informado. Informe a matricula.')
      }
      pessoa = matching[0]
    }

    if (!pessoa) {
      throw createError(404, 'Colaborador nao encontrado para os dados informados.')
    }

    const pessoaRecord = mapLocalPessoaRecord(pessoa)

    const saidasPessoa = (Array.isArray(state.saidas) ? state.saidas : []).filter(
      (saida) => saida.pessoaId === pessoa.id,
    )

    if (!saidasPessoa.length) {
      throw createError(404, 'Nenhuma saida registrada para o colaborador informado.')
    }

    const materiaisMap = new Map(
      (Array.isArray(state.materiais) ? state.materiais : []).map((material) => [
        material.id,
        mapLocalMaterialResumo(material),
      ]),
    )

    const saidasDetalhadas = saidasPessoa.map((saida) => ({
      ...saida,
      material: materiaisMap.get(saida.materialId) || null,
    }))

    const contextoBase = montarContextoTermoEpiLocal(pessoaRecord, saidasDetalhadas)
    return {
      ...contextoBase,
      empresa: resolveEmpresaInfoLocal(),
      origem: 'local',
    }
  })
}

