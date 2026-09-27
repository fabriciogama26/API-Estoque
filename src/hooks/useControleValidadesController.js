import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useErrorLogger } from './useErrorLogger.js'
import { usePermissions } from '../context/PermissionsContext.jsx'
import { isLocalMode } from '../config/runtime.js'
import {
  VALIDADES_FILTER_DEFAULT,
  VALIDADES_PAGE_SIZE,
  VALIDADES_REGISTRO_DEFAULT,
} from '../config/ValidadesConfig.js'
import {
  cancelarRealizacao,
  carregarCatalogosValidades,
  dispensarRequisito,
  editarRealizacao,
  fetchValidadesContexto,
  historicoValidade,
  listarRequisitos,
  listarTodasValidades,
  listarValidades,
  registrarRealizacao,
  renovarRealizacao,
  resumoValidades,
  revogarDispensa,
  simularVencimento,
} from '../services/validadesApi.js'
import { searchPessoas } from '../services/pessoasService.js'
import { downloadValidadesCsv } from '../utils/validadesExport.js'
import { resolveErrorMessage, todayLocalKey } from '../utils/validadesUtils.js'

const PESSOA_SEARCH_MIN_CHARS = 2
const PESSOA_SEARCH_DEBOUNCE_MS = 300
const PREVIA_DEBOUNCE_MS = 250

const ACAO_STATE_DEFAULT = {
  open: false,
  modo: 'renovar',
  item: null,
  form: { data_realizacao: '', numero_documento: '', entidade_emissora: '', observacao: '', motivo: '' },
  previa: null,
  isSaving: false,
  error: null,
}

const MOTIVO_STATE_DEFAULT = { open: false, tipo: '', titulo: '', descricao: '', item: null, motivo: '', isSaving: false, error: null }
const DISPENSA_STATE_DEFAULT = { open: false, item: null, motivo: '', valida_ate: '', isSaving: false, error: null }
const HISTORICO_STATE_DEFAULT = { open: false, item: null, data: null, isLoading: false, error: null }

export function useControleValidadesController() {
  const { reportError } = useErrorLogger('controle_validades')
  const { ownerId } = usePermissions()
  const disponivel = !isLocalMode

  const [contexto, setContexto] = useState(null)
  const [catalogos, setCatalogos] = useState({ cargos: [], setores: [], centrosServico: [], centrosCusto: [] })
  const [requisitos, setRequisitos] = useState([])
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState(() => ({ ...VALIDADES_FILTER_DEFAULT }))
  const [applied, setApplied] = useState(() => ({ ...VALIDADES_FILTER_DEFAULT }))
  const [tab, setTab] = useState('painel')
  const [page, setPage] = useState(1)
  const [lista, setLista] = useState({ itens: [], total: 0 })
  const [listaLoading, setListaLoading] = useState(false)
  const [resumo, setResumo] = useState(null)
  const [resumoLoading, setResumoLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState(false)

  const [registro, setRegistro] = useState(() => ({ ...VALIDADES_REGISTRO_DEFAULT }))
  const [registroPrevia, setRegistroPrevia] = useState(null)
  const [registroSaving, setRegistroSaving] = useState(false)
  const [registroFeedback, setRegistroFeedback] = useState(null)
  const [registroConflito, setRegistroConflito] = useState(null)
  const [pessoaBusca, setPessoaBusca] = useState('')
  const [pessoaSugestoes, setPessoaSugestoes] = useState([])
  const [pessoaBuscando, setPessoaBuscando] = useState(false)
  const [pessoaDropdownOpen, setPessoaDropdownOpen] = useState(false)
  const pessoaBlurRef = useRef(null)

  const [acaoState, setAcaoState] = useState(() => ({ ...ACAO_STATE_DEFAULT }))
  const [motivoState, setMotivoState] = useState(() => ({ ...MOTIVO_STATE_DEFAULT }))
  const [dispensaState, setDispensaState] = useState(() => ({ ...DISPENSA_STATE_DEFAULT }))
  const [historicoState, setHistoricoState] = useState(() => ({ ...HISTORICO_STATE_DEFAULT }))

  const permissoes = useMemo(
    () => ({
      registrar: Boolean(contexto?.pode_registrar),
      renovar: Boolean(contexto?.pode_renovar),
      gerenciarRequisitos: Boolean(contexto?.pode_gerenciar_requisitos),
    }),
    [contexto],
  )

  const requisitosAtivos = useMemo(() => requisitos.filter((item) => item.ativo), [requisitos])

  useEffect(() => {
    if (!disponivel || !ownerId) return
    let ativo = true
    ;(async () => {
      try {
        const [ctx, cat, reqs] = await Promise.all([
          fetchValidadesContexto(ownerId),
          carregarCatalogosValidades(),
          listarRequisitos(ownerId),
        ])
        if (!ativo) return
        setContexto(ctx)
        setCatalogos(cat)
        setRequisitos(Array.isArray(reqs) ? reqs : [])
      } catch (err) {
        if (ativo) setError(resolveErrorMessage(err, 'Falha ao carregar o controle de validades.'))
        reportError(err, { area: 'validades_contexto' })
      }
    })()
    return () => {
      ativo = false
    }
  }, [disponivel, ownerId, reportError])

  // Lista (paginada no servidor) e painel usam os mesmos filtros aplicados.
  useEffect(() => {
    if (!disponivel || !ownerId) return undefined
    let ativo = true
    setListaLoading(true)
    listarValidades(ownerId, applied, { limite: VALIDADES_PAGE_SIZE, offset: (page - 1) * VALIDADES_PAGE_SIZE })
      .then((data) => {
        if (!ativo) return
        setLista({ itens: Array.isArray(data?.itens) ? data.itens : [], total: Number(data?.total ?? 0) })
        setError(null)
      })
      .catch((err) => {
        if (!ativo) return
        setError(resolveErrorMessage(err, 'Falha ao carregar a lista.'))
        reportError(err, { area: 'validades_lista' })
      })
      .finally(() => {
        if (ativo) setListaLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [applied, disponivel, ownerId, page, reloadKey, reportError])

  useEffect(() => {
    if (!disponivel || !ownerId) return undefined
    let ativo = true
    setResumoLoading(true)
    resumoValidades(ownerId, applied)
      .then((data) => {
        if (ativo) setResumo(data || null)
      })
      .catch((err) => {
        if (!ativo) return
        setError(resolveErrorMessage(err, 'Falha ao carregar o painel.'))
        reportError(err, { area: 'validades_resumo' })
      })
      .finally(() => {
        if (ativo) setResumoLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [applied, disponivel, ownerId, reloadKey, reportError])

  const refresh = useCallback(() => setReloadKey((prev) => prev + 1), [])

  // Filtros e drill-down

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event?.preventDefault?.()
    setPage(1)
    setApplied({ ...filters })
  }

  const handleFilterClear = () => {
    const limpos = { ...VALIDADES_FILTER_DEFAULT }
    setFilters(limpos)
    setPage(1)
    setApplied(limpos)
  }

  // Clique em card/grafico: aplica o recorte sobre os filtros atuais e abre a lista.
  const aplicarDrill = (parcial) => {
    const proximo = { ...applied, exigencia: 'exigido', ...parcial }
    setFilters(proximo)
    setApplied(proximo)
    setPage(1)
    setTab('lista')
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const itens = await listarTodasValidades(ownerId, applied)
      downloadValidadesCsv(itens, `controle-validades-${todayLocalKey()}.csv`)
    } catch (err) {
      setError(resolveErrorMessage(err, 'Falha ao exportar.'))
      reportError(err, { area: 'validades_exportar' })
    } finally {
      setExporting(false)
    }
  }

  // Registro de realizacao (bloco superior)

  useEffect(() => {
    const termo = pessoaBusca.trim()
    if (registro.pessoaId || termo.length < PESSOA_SEARCH_MIN_CHARS) {
      setPessoaSugestoes([])
      setPessoaBuscando(false)
      return undefined
    }
    const timeout = setTimeout(async () => {
      setPessoaBuscando(true)
      try {
        const lista = await searchPessoas({ termo, limit: 8 })
        setPessoaSugestoes(Array.isArray(lista) ? lista : [])
        setPessoaDropdownOpen(true)
      } catch (err) {
        setPessoaSugestoes([])
        reportError(err, { area: 'validades_pessoa_busca' })
      } finally {
        setPessoaBuscando(false)
      }
    }, PESSOA_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [pessoaBusca, registro.pessoaId, reportError])

  // Previa do vencimento calculada no banco (mesma funcao usada ao gravar).
  useEffect(() => {
    if (!disponivel || !ownerId || !registro.requisitoId || !registro.dataRealizacao) {
      setRegistroPrevia(null)
      return undefined
    }
    let ativo = true
    const timeout = setTimeout(async () => {
      try {
        const data = await simularVencimento(ownerId, registro.requisitoId, registro.dataRealizacao)
        if (ativo) setRegistroPrevia(data || null)
      } catch (err) {
        if (ativo) setRegistroPrevia(null)
        reportError(err, { area: 'validades_previa' })
      }
    }, PREVIA_DEBOUNCE_MS)
    return () => {
      ativo = false
      clearTimeout(timeout)
    }
  }, [disponivel, ownerId, registro.requisitoId, registro.dataRealizacao, reportError])

  const handleRegistroChange = (event) => {
    const { name, value } = event.target
    setRegistroFeedback(null)
    setRegistroConflito(null)
    setRegistro((prev) => ({ ...prev, [name]: value }))
  }

  const handlePessoaInputChange = (event) => {
    const { value } = event.target
    setPessoaBusca(value)
    setPessoaDropdownOpen(true)
    setRegistroConflito(null)
    setRegistro((prev) => ({ ...prev, pessoaId: '', pessoaNome: '', matricula: '' }))
  }

  const handlePessoaSelect = (pessoa) => {
    if (!pessoa?.id) return
    setRegistro((prev) => ({ ...prev, pessoaId: pessoa.id, pessoaNome: pessoa.nome ?? '', matricula: pessoa.matricula ?? '' }))
    setPessoaBusca([pessoa.matricula, pessoa.nome].filter(Boolean).join(' - '))
    setPessoaSugestoes([])
    setPessoaDropdownOpen(false)
  }

  const handlePessoaFocus = () => {
    if (pessoaBlurRef.current) clearTimeout(pessoaBlurRef.current)
    setPessoaDropdownOpen(true)
  }

  const handlePessoaBlur = () => {
    pessoaBlurRef.current = setTimeout(() => setPessoaDropdownOpen(false), 150)
  }

  const resetRegistro = () => {
    setRegistro({ ...VALIDADES_REGISTRO_DEFAULT })
    setPessoaBusca('')
    setPessoaSugestoes([])
    setRegistroPrevia(null)
    setRegistroConflito(null)
  }

  // Linha pendente -> preenche o bloco de registro com colaborador e requisito.
  const prepararRegistro = (item) => {
    if (!item) return
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setRegistroFeedback(null)
    setRegistroConflito(null)
    setRegistro({
      ...VALIDADES_REGISTRO_DEFAULT,
      pessoaId: item.pessoa_id,
      pessoaNome: item.pessoa_nome ?? '',
      matricula: item.matricula ?? '',
      requisitoId: item.requisito_id,
    })
    setPessoaBusca([item.matricula, item.pessoa_nome].filter(Boolean).join(' - '))
  }

  const handleRegistroSubmit = async (event) => {
    event?.preventDefault?.()
    setRegistroFeedback(null)
    setRegistroConflito(null)
    if (!registro.pessoaId) {
      setRegistroFeedback({ tipo: 'error', mensagem: 'Selecione o colaborador pela matricula ou nome.' })
      return
    }
    if (!registro.requisitoId) {
      setRegistroFeedback({ tipo: 'error', mensagem: 'Selecione o requisito.' })
      return
    }
    if (!registro.dataRealizacao) {
      setRegistroFeedback({ tipo: 'error', mensagem: 'Informe a data de realizacao ou emissao.' })
      return
    }
    setRegistroSaving(true)
    try {
      const resultado = await registrarRealizacao(ownerId, {
        pessoa_id: registro.pessoaId,
        requisito_id: registro.requisitoId,
        data_realizacao: registro.dataRealizacao,
        numero_documento: registro.numeroDocumento,
        entidade_emissora: registro.entidadeEmissora,
        observacao: registro.observacao,
      })
      resetRegistro()
      setRegistroFeedback({
        tipo: 'success',
        mensagem: resultado?.retroativo
          ? 'Registro guardado no historico: a data e anterior a realizacao vigente, que continua valendo.'
          : 'Realizacao registrada.',
      })
      refresh()
    } catch (err) {
      if (err?.hint === 'use_renovar') {
        const requisito = requisitos.find((item) => item.id === registro.requisitoId)
        setRegistroConflito({
          mensagem: err.message,
          item: {
            realizacao_id: err.details,
            pessoa_id: registro.pessoaId,
            pessoa_nome: registro.pessoaNome,
            matricula: registro.matricula,
            requisito_id: registro.requisitoId,
            requisito_nome: requisito?.nome ?? '',
            data_realizacao: null,
          },
          dataSugerida: registro.dataRealizacao,
        })
      } else {
        setRegistroFeedback({ tipo: 'error', mensagem: resolveErrorMessage(err, 'Falha ao registrar.') })
      }
      reportError(err, { area: 'validades_registrar' })
    } finally {
      setRegistroSaving(false)
    }
  }

  // Renovar / editar (modal)

  const openAcao = (modo, item, dataSugerida = '') => {
    if (!item?.realizacao_id) return
    setAcaoState({
      ...ACAO_STATE_DEFAULT,
      open: true,
      modo,
      item,
      form: {
        data_realizacao: modo === 'editar' ? item.data_realizacao ?? '' : dataSugerida,
        numero_documento: modo === 'editar' ? item.numero_documento ?? '' : '',
        entidade_emissora: modo === 'editar' ? item.entidade_emissora ?? '' : item.entidade_emissora ?? '',
        observacao: modo === 'editar' ? item.observacao ?? '' : '',
        motivo: '',
      },
    })
  }

  const renovarDoConflito = () => {
    if (!registroConflito?.item) return
    openAcao('renovar', registroConflito.item, registroConflito.dataSugerida)
    setRegistroConflito(null)
  }

  const closeAcao = () => setAcaoState({ ...ACAO_STATE_DEFAULT })

  const acaoRenovando = acaoState.open && acaoState.modo === 'renovar'
  const acaoRequisitoId = acaoState.item?.requisito_id
  const acaoData = acaoState.form.data_realizacao

  // Renovacao usa a validade vigente do requisito, entao a previa vem da mesma funcao do banco.
  useEffect(() => {
    if (!acaoRenovando || !acaoRequisitoId || !acaoData) {
      return undefined
    }
    let ativo = true
    const timeout = setTimeout(async () => {
      try {
        const data = await simularVencimento(ownerId, acaoRequisitoId, acaoData)
        if (ativo) setAcaoState((prev) => ({ ...prev, previa: data || null }))
      } catch (err) {
        reportError(err, { area: 'validades_previa_renovacao' })
      }
    }, PREVIA_DEBOUNCE_MS)
    return () => {
      ativo = false
      clearTimeout(timeout)
    }
  }, [acaoRenovando, acaoRequisitoId, acaoData, ownerId, reportError])

  const handleAcaoChange = (event) => {
    const { name, value } = event.target
    setAcaoState((prev) => ({
      ...prev,
      error: null,
      previa: name === 'data_realizacao' ? null : prev.previa,
      form: { ...prev.form, [name]: value },
    }))
  }

  const handleAcaoSubmit = async (event) => {
    event?.preventDefault?.()
    const { modo, item, form } = acaoState
    if (!form.data_realizacao) {
      setAcaoState((prev) => ({ ...prev, error: 'Informe a data de realizacao.' }))
      return
    }
    if (modo === 'editar' && form.motivo.trim().length < 3) {
      setAcaoState((prev) => ({ ...prev, error: 'Informe o motivo da edicao.' }))
      return
    }
    setAcaoState((prev) => ({ ...prev, isSaving: true, error: null }))
    const payload = {
      data_realizacao: form.data_realizacao,
      numero_documento: form.numero_documento,
      entidade_emissora: form.entidade_emissora,
      observacao: form.observacao,
    }
    try {
      if (modo === 'renovar') {
        await renovarRealizacao(ownerId, item.realizacao_id, payload)
      } else {
        await editarRealizacao(ownerId, item.realizacao_id, payload, form.motivo)
      }
      closeAcao()
      refresh()
    } catch (err) {
      setAcaoState((prev) => ({ ...prev, isSaving: false, error: resolveErrorMessage(err, 'Falha ao salvar.') }))
      reportError(err, { area: `validades_${modo}` })
    }
  }

  // Cancelar registro / revogar dispensa (motivo obrigatorio)

  const openCancelar = (item) =>
    setMotivoState({
      ...MOTIVO_STATE_DEFAULT,
      open: true,
      tipo: 'cancelar',
      titulo: 'Cancelar registro',
      descricao:
        'O registro fica marcado como cancelado no historico (nao e apagado). Se houver realizacao anterior, ela volta a ser a vigente.',
      item,
    })

  const openRevogarDispensa = (item) =>
    setMotivoState({
      ...MOTIVO_STATE_DEFAULT,
      open: true,
      tipo: 'revogar',
      titulo: 'Revogar dispensa',
      descricao: 'O requisito volta a ser cobrado deste colaborador.',
      item,
    })

  const closeMotivo = () => setMotivoState({ ...MOTIVO_STATE_DEFAULT })

  const handleMotivoChange = (event) => {
    const { value } = event.target
    setMotivoState((prev) => ({ ...prev, motivo: value, error: null }))
  }

  const handleMotivoSubmit = async (event) => {
    event?.preventDefault?.()
    if (motivoState.motivo.trim().length < 3) {
      setMotivoState((prev) => ({ ...prev, error: 'Informe o motivo (minimo 3 caracteres).' }))
      return
    }
    setMotivoState((prev) => ({ ...prev, isSaving: true, error: null }))
    try {
      if (motivoState.tipo === 'cancelar') {
        await cancelarRealizacao(ownerId, motivoState.item.realizacao_id, motivoState.motivo)
      } else {
        await revogarDispensa(ownerId, motivoState.item.dispensa_id, motivoState.motivo)
      }
      closeMotivo()
      refresh()
    } catch (err) {
      setMotivoState((prev) => ({ ...prev, isSaving: false, error: resolveErrorMessage(err, 'Falha ao salvar.') }))
      reportError(err, { area: `validades_${motivoState.tipo}` })
    }
  }

  // Dispensa

  const openDispensa = (item) => setDispensaState({ ...DISPENSA_STATE_DEFAULT, open: true, item })
  const closeDispensa = () => setDispensaState({ ...DISPENSA_STATE_DEFAULT })

  const handleDispensaChange = (event) => {
    const { name, value } = event.target
    setDispensaState((prev) => ({ ...prev, [name]: value, error: null }))
  }

  const handleDispensaSubmit = async (event) => {
    event?.preventDefault?.()
    if (dispensaState.motivo.trim().length < 3) {
      setDispensaState((prev) => ({ ...prev, error: 'Informe o motivo da dispensa.' }))
      return
    }
    setDispensaState((prev) => ({ ...prev, isSaving: true, error: null }))
    try {
      await dispensarRequisito(ownerId, {
        pessoa_id: dispensaState.item.pessoa_id,
        requisito_id: dispensaState.item.requisito_id,
        motivo: dispensaState.motivo,
        valida_ate: dispensaState.valida_ate || null,
      })
      closeDispensa()
      refresh()
    } catch (err) {
      setDispensaState((prev) => ({ ...prev, isSaving: false, error: resolveErrorMessage(err, 'Falha ao dispensar.') }))
      reportError(err, { area: 'validades_dispensar' })
    }
  }

  // Historico por colaborador/requisito

  const openHistorico = async (item) => {
    setHistoricoState({ ...HISTORICO_STATE_DEFAULT, open: true, item, isLoading: true })
    try {
      const data = await historicoValidade(ownerId, item.pessoa_id, item.requisito_id)
      setHistoricoState((prev) => ({ ...prev, isLoading: false, data }))
    } catch (err) {
      setHistoricoState((prev) => ({ ...prev, isLoading: false, error: resolveErrorMessage(err, 'Falha ao carregar historico.') }))
      reportError(err, { area: 'validades_historico' })
    }
  }

  const closeHistorico = () => setHistoricoState({ ...HISTORICO_STATE_DEFAULT })

  return {
    disponivel,
    contexto,
    permissoes,
    catalogos,
    requisitos,
    requisitosAtivos,
    error,
    filters,
    applied,
    tab,
    setTab,
    page,
    setPage,
    lista,
    listaLoading,
    resumo,
    resumoLoading,
    exporting,
    refresh,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    aplicarDrill,
    handleExport,
    registro,
    registroPrevia,
    registroSaving,
    registroFeedback,
    registroConflito,
    pessoaBusca,
    pessoaSugestoes,
    pessoaBuscando,
    pessoaDropdownOpen,
    handleRegistroChange,
    handlePessoaInputChange,
    handlePessoaSelect,
    handlePessoaFocus,
    handlePessoaBlur,
    handleRegistroSubmit,
    resetRegistro,
    prepararRegistro,
    renovarDoConflito,
    acaoState,
    openAcao,
    closeAcao,
    handleAcaoChange,
    handleAcaoSubmit,
    motivoState,
    openCancelar,
    openRevogarDispensa,
    closeMotivo,
    handleMotivoChange,
    handleMotivoSubmit,
    dispensaState,
    openDispensa,
    closeDispensa,
    handleDispensaChange,
    handleDispensaSubmit,
    historicoState,
    openHistorico,
    closeHistorico,
  }
}
