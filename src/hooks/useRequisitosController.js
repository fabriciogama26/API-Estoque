import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useErrorLogger } from './useErrorLogger.js'
import { usePermissions } from '../context/PermissionsContext.jsx'
import { isLocalMode } from '../config/runtime.js'
import { REGRA_FORM_DEFAULT, REQUISITO_FORM_DEFAULT } from '../config/ValidadesConfig.js'
import {
  adicionarRegra,
  atualizarConfigValidades,
  carregarCatalogosValidades,
  definirRequisitoAtivo,
  fetchValidadesContexto,
  historicoRequisito,
  listarRegrasRequisito,
  listarRequisitos,
  previaRegra,
  removerRegra,
  salvarRequisito,
} from '../services/validadesApi.js'
import { searchPessoas } from '../services/pessoasService.js'
import { resolveErrorMessage } from '../utils/validadesUtils.js'

const PESSOA_SEARCH_MIN_CHARS = 2
const PESSOA_SEARCH_DEBOUNCE_MS = 300

const REGRAS_STATE_DEFAULT = {
  open: false,
  requisito: null,
  regras: [],
  isLoading: false,
  error: null,
  form: { ...REGRA_FORM_DEFAULT },
  previa: null,
  isSaving: false,
}

const MOTIVO_STATE_DEFAULT = {
  open: false,
  tipo: '',
  titulo: '',
  descricao: '',
  alvo: null,
  motivo: '',
  isSaving: false,
  error: null,
}

const HISTORICO_STATE_DEFAULT = { open: false, requisito: null, eventos: [], isLoading: false, error: null }

const CONFIG_FORM_DEFAULT = {
  janela_critica_dias: 7,
  alertas_ativos: true,
  alerta_janela_ativo: true,
  alerta_vencimento_ativo: true,
  alerta_vencimento_tolerancia_dias: 7,
  timezone: 'America/Sao_Paulo',
  motivo: '',
}

const toRequisitoForm = (requisito) => ({
  ...REQUISITO_FORM_DEFAULT,
  nome: requisito?.nome ?? '',
  codigo: requisito?.codigo ?? '',
  categoria: requisito?.categoria ?? 'treinamento',
  tipo: requisito?.tipo ?? 'interno',
  descricao: requisito?.descricao ?? '',
  possuiValidade: requisito?.possui_validade !== false,
  validadeQuantidade: requisito?.validade_quantidade ?? '',
  validadeUnidade: requisito?.validade_unidade ?? 'meses',
  observacao: requisito?.observacao ?? '',
  motivo: '',
})

const toConfigForm = (config) => ({
  ...CONFIG_FORM_DEFAULT,
  ...(config || {}),
  motivo: '',
})

const regraPayload = (form) => ({
  cargo_id: form.cargo_id || null,
  setor_id: form.setor_id || null,
  centro_servico_id: form.centro_servico_id || null,
  centro_custo_id: form.centro_custo_id || null,
  pessoa_id: form.pessoa_id || null,
})

export function useRequisitosController() {
  const { reportError } = useErrorLogger('requisitos_controle')
  const { ownerId } = usePermissions()
  const disponivel = !isLocalMode

  const [contexto, setContexto] = useState(null)
  const [requisitos, setRequisitos] = useState([])
  const [catalogos, setCatalogos] = useState({ cargos: [], setores: [], centrosServico: [], centrosCusto: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(true)

  const [form, setForm] = useState(() => ({ ...REQUISITO_FORM_DEFAULT }))
  const [editing, setEditing] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const [regrasState, setRegrasState] = useState(() => ({ ...REGRAS_STATE_DEFAULT }))
  const [motivoState, setMotivoState] = useState(() => ({ ...MOTIVO_STATE_DEFAULT }))
  const [historicoState, setHistoricoState] = useState(() => ({ ...HISTORICO_STATE_DEFAULT }))

  const [configForm, setConfigForm] = useState(() => ({ ...CONFIG_FORM_DEFAULT }))
  const [configSaving, setConfigSaving] = useState(false)
  const [configFeedback, setConfigFeedback] = useState(null)

  const [pessoaBusca, setPessoaBusca] = useState('')
  const [pessoaSugestoes, setPessoaSugestoes] = useState([])
  const [pessoaBuscando, setPessoaBuscando] = useState(false)
  const previaSeqRef = useRef(0)

  const permissoes = useMemo(
    () => ({
      gerenciarRequisitos: Boolean(contexto?.pode_gerenciar_requisitos),
      gerenciarRegras: Boolean(contexto?.pode_gerenciar_regras),
    }),
    [contexto],
  )

  const loadRequisitos = useCallback(async () => {
    if (!disponivel || !ownerId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await listarRequisitos(ownerId)
      setRequisitos(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(resolveErrorMessage(err, 'Falha ao carregar requisitos.'))
      reportError(err, { area: 'requisitos_listar' })
    } finally {
      setIsLoading(false)
    }
  }, [disponivel, ownerId, reportError])

  useEffect(() => {
    if (!disponivel || !ownerId) return
    let ativo = true
    ;(async () => {
      try {
        const [ctx, cat] = await Promise.all([fetchValidadesContexto(ownerId), carregarCatalogosValidades()])
        if (!ativo) return
        setContexto(ctx)
        setConfigForm(toConfigForm(ctx?.config))
        setCatalogos(cat)
      } catch (err) {
        if (ativo) setError(resolveErrorMessage(err, 'Falha ao carregar o modulo.'))
        reportError(err, { area: 'requisitos_contexto' })
      }
    })()
    loadRequisitos()
    return () => {
      ativo = false
    }
  }, [disponivel, ownerId, loadRequisitos, reportError])

  const requisitosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return requisitos.filter((item) => {
      if (!mostrarInativos && !item.ativo) return false
      if (!termo) return true
      return [item.nome, item.codigo, item.descricao].some((valor) => String(valor || '').toLowerCase().includes(termo))
    })
  }, [busca, mostrarInativos, requisitos])

  // Formulario de requisito

  const validadeAlterada = useMemo(() => {
    if (!editing) return false
    const possui = Boolean(form.possuiValidade)
    return (
      possui !== (editing.possui_validade !== false) ||
      (possui && Number(form.validadeQuantidade) !== Number(editing.validade_quantidade)) ||
      (possui && form.validadeUnidade !== editing.validade_unidade)
    )
  }, [editing, form.possuiValidade, form.validadeQuantidade, form.validadeUnidade])

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const resetForm = useCallback(() => {
    setEditing(null)
    setForm({ ...REQUISITO_FORM_DEFAULT })
    setFormError(null)
  }, [])

  const startEdit = (requisito) => {
    if (!requisito) return
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setEditing(requisito)
    setForm(toRequisitoForm(requisito))
    setFormError(null)
  }

  const handleSubmit = async (event) => {
    event?.preventDefault?.()
    setFormError(null)
    if (!form.nome.trim()) {
      setFormError('Informe o nome do requisito.')
      return
    }
    if (form.possuiValidade && (!form.validadeQuantidade || Number(form.validadeQuantidade) < 1)) {
      setFormError('Informe o periodo de validade.')
      return
    }
    if (validadeAlterada && form.motivo.trim().length < 3) {
      setFormError('Informe o motivo da alteracao da validade. Registros ja realizados mantem a validade antiga.')
      return
    }
    setIsSaving(true)
    try {
      await salvarRequisito(
        ownerId,
        editing?.id ?? null,
        {
          nome: form.nome,
          codigo: form.codigo,
          categoria: form.categoria,
          tipo: form.tipo,
          descricao: form.descricao,
          possui_validade: Boolean(form.possuiValidade),
          validade_quantidade: form.possuiValidade ? Number(form.validadeQuantidade) : null,
          validade_unidade: form.possuiValidade ? form.validadeUnidade : null,
          observacao: form.observacao,
        },
        form.motivo,
      )
      resetForm()
      await loadRequisitos()
    } catch (err) {
      setFormError(resolveErrorMessage(err, 'Falha ao salvar o requisito.'))
      reportError(err, { area: 'requisito_salvar', editing: Boolean(editing) })
    } finally {
      setIsSaving(false)
    }
  }

  // Motivo (inativar requisito / remover regra)

  const openInativar = (requisito) =>
    setMotivoState({
      ...MOTIVO_STATE_DEFAULT,
      open: true,
      tipo: 'inativar',
      titulo: 'Inativar requisito',
      descricao: `O requisito "${requisito?.nome}" deixa de ser cobrado e sai do controle e dos alertas. O historico e mantido.`,
      alvo: requisito,
    })

  const handleAtivar = async (requisito) => {
    try {
      await definirRequisitoAtivo(ownerId, requisito.id, true, 'Reativacao do requisito')
      await loadRequisitos()
    } catch (err) {
      setError(resolveErrorMessage(err, 'Falha ao ativar o requisito.'))
      reportError(err, { area: 'requisito_ativar', requisitoId: requisito?.id })
    }
  }

  const openRemoverRegra = (regra) =>
    setMotivoState({
      ...MOTIVO_STATE_DEFAULT,
      open: true,
      tipo: 'remover_regra',
      titulo: 'Remover regra de aplicabilidade',
      descricao: `A regra "${regra?.descricao}" deixa de gerar exigencia. Registros ja realizados continuam no historico.`,
      alvo: regra,
    })

  const closeMotivo = () => setMotivoState({ ...MOTIVO_STATE_DEFAULT })

  const handleMotivoChange = (event) => {
    const { value } = event.target
    setMotivoState((prev) => ({ ...prev, motivo: value }))
  }

  const handleMotivoSubmit = async (event) => {
    event?.preventDefault?.()
    if (motivoState.motivo.trim().length < 3) {
      setMotivoState((prev) => ({ ...prev, error: 'Informe o motivo (minimo 3 caracteres).' }))
      return
    }
    setMotivoState((prev) => ({ ...prev, isSaving: true, error: null }))
    try {
      if (motivoState.tipo === 'inativar') {
        await definirRequisitoAtivo(ownerId, motivoState.alvo.id, false, motivoState.motivo)
        await loadRequisitos()
      } else if (motivoState.tipo === 'remover_regra') {
        const regras = await removerRegra(ownerId, motivoState.alvo.id, motivoState.motivo)
        setRegrasState((prev) => ({ ...prev, regras: Array.isArray(regras) ? regras : [] }))
        await loadRequisitos()
      }
      closeMotivo()
    } catch (err) {
      setMotivoState((prev) => ({ ...prev, isSaving: false, error: resolveErrorMessage(err, 'Falha ao salvar.') }))
      reportError(err, { area: `requisito_${motivoState.tipo}` })
    }
  }

  // Regras de aplicabilidade

  const openRegras = async (requisito) => {
    setRegrasState({ ...REGRAS_STATE_DEFAULT, open: true, requisito, isLoading: true })
    setPessoaBusca('')
    setPessoaSugestoes([])
    try {
      const regras = await listarRegrasRequisito(ownerId, requisito.id)
      setRegrasState((prev) => ({ ...prev, isLoading: false, regras: Array.isArray(regras) ? regras : [] }))
    } catch (err) {
      setRegrasState((prev) => ({ ...prev, isLoading: false, error: resolveErrorMessage(err, 'Falha ao carregar regras.') }))
      reportError(err, { area: 'requisito_regras', requisitoId: requisito?.id })
    }
  }

  const closeRegras = () => {
    setRegrasState({ ...REGRAS_STATE_DEFAULT })
    setPessoaBusca('')
    setPessoaSugestoes([])
  }

  const atualizarPrevia = useCallback(
    async (nextForm) => {
      const payload = regraPayload(nextForm)
      const temCriterio = Object.values(payload).some(Boolean)
      const seq = previaSeqRef.current + 1
      previaSeqRef.current = seq
      if (!temCriterio) {
        setRegrasState((prev) => ({ ...prev, previa: null }))
        return
      }
      try {
        const data = await previaRegra(ownerId, payload)
        if (previaSeqRef.current === seq) {
          setRegrasState((prev) => ({ ...prev, previa: Number(data?.pessoas ?? 0) }))
        }
      } catch (err) {
        reportError(err, { area: 'requisito_previa' })
      }
    },
    [ownerId, reportError],
  )

  const aplicarFormRegra = (nextForm) => {
    setRegrasState((prev) => ({ ...prev, form: nextForm, error: null }))
    atualizarPrevia(nextForm)
  }

  const handleRegraChange = (event) => {
    const { name, value } = event.target
    aplicarFormRegra({ ...regrasState.form, [name]: value })
  }

  useEffect(() => {
    const termo = pessoaBusca.trim()
    if (!regrasState.open || regrasState.form.pessoa_id || termo.length < PESSOA_SEARCH_MIN_CHARS) {
      setPessoaSugestoes([])
      return undefined
    }
    const timeout = setTimeout(async () => {
      setPessoaBuscando(true)
      try {
        const lista = await searchPessoas({ termo, limit: 8 })
        setPessoaSugestoes(Array.isArray(lista) ? lista : [])
      } catch (err) {
        setPessoaSugestoes([])
        reportError(err, { area: 'requisito_regra_pessoa' })
      } finally {
        setPessoaBuscando(false)
      }
    }, PESSOA_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [pessoaBusca, regrasState.open, regrasState.form.pessoa_id, reportError])

  const handlePessoaBuscaChange = (event) => {
    setPessoaBusca(event.target.value)
    if (regrasState.form.pessoa_id) {
      aplicarFormRegra({ ...regrasState.form, pessoa_id: '', pessoaLabel: '' })
    }
  }

  const handlePessoaSelect = (pessoa) => {
    if (!pessoa?.id) return
    const label = [pessoa.matricula, pessoa.nome].filter(Boolean).join(' - ')
    setPessoaBusca(label)
    setPessoaSugestoes([])
    aplicarFormRegra({ ...regrasState.form, pessoa_id: pessoa.id, pessoaLabel: label })
  }

  const handleRegraSubmit = async (event) => {
    event?.preventDefault?.()
    const payload = regraPayload(regrasState.form)
    if (!Object.values(payload).some(Boolean)) {
      setRegrasState((prev) => ({ ...prev, error: 'Escolha ao menos um criterio.' }))
      return
    }
    setRegrasState((prev) => ({ ...prev, isSaving: true, error: null }))
    try {
      const regras = await adicionarRegra(ownerId, regrasState.requisito.id, payload)
      setRegrasState((prev) => ({
        ...prev,
        isSaving: false,
        regras: Array.isArray(regras) ? regras : [],
        form: { ...REGRA_FORM_DEFAULT },
        previa: null,
      }))
      setPessoaBusca('')
      await loadRequisitos()
    } catch (err) {
      setRegrasState((prev) => ({ ...prev, isSaving: false, error: resolveErrorMessage(err, 'Falha ao adicionar a regra.') }))
      reportError(err, { area: 'requisito_regra_adicionar' })
    }
  }

  // Historico

  const openHistorico = async (requisito) => {
    setHistoricoState({ ...HISTORICO_STATE_DEFAULT, open: true, requisito, isLoading: true })
    try {
      const eventos = await historicoRequisito(ownerId, requisito.id)
      setHistoricoState((prev) => ({ ...prev, isLoading: false, eventos: Array.isArray(eventos) ? eventos : [] }))
    } catch (err) {
      setHistoricoState((prev) => ({ ...prev, isLoading: false, error: resolveErrorMessage(err, 'Falha ao carregar historico.') }))
      reportError(err, { area: 'requisito_historico', requisitoId: requisito?.id })
    }
  }

  const closeHistorico = () => setHistoricoState({ ...HISTORICO_STATE_DEFAULT })

  // Configuracao do modulo

  const handleConfigChange = (event) => {
    const { name, value, type, checked } = event.target
    setConfigFeedback(null)
    setConfigForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleConfigSubmit = async (event) => {
    event?.preventDefault?.()
    if (configForm.motivo.trim().length < 3) {
      setConfigFeedback({ tipo: 'error', mensagem: 'Informe o motivo da alteracao.' })
      return
    }
    setConfigSaving(true)
    setConfigFeedback(null)
    try {
      const config = await atualizarConfigValidades(
        ownerId,
        {
          janela_critica_dias: Number(configForm.janela_critica_dias),
          alertas_ativos: Boolean(configForm.alertas_ativos),
          alerta_janela_ativo: Boolean(configForm.alerta_janela_ativo),
          alerta_vencimento_ativo: Boolean(configForm.alerta_vencimento_ativo),
          alerta_vencimento_tolerancia_dias: Number(configForm.alerta_vencimento_tolerancia_dias),
          timezone: configForm.timezone,
        },
        configForm.motivo,
      )
      setContexto((prev) => ({ ...(prev || {}), config }))
      setConfigForm(toConfigForm(config))
      setConfigFeedback({ tipo: 'success', mensagem: 'Configuracao salva.' })
      await loadRequisitos()
    } catch (err) {
      setConfigFeedback({ tipo: 'error', mensagem: resolveErrorMessage(err, 'Falha ao salvar a configuracao.') })
      reportError(err, { area: 'requisitos_config' })
    } finally {
      setConfigSaving(false)
    }
  }

  return {
    disponivel,
    contexto,
    permissoes,
    catalogos,
    requisitos: requisitosFiltrados,
    totalRequisitos: requisitos.length,
    isLoading,
    error,
    busca,
    setBusca,
    mostrarInativos,
    setMostrarInativos,
    form,
    editing,
    isSaving,
    formError,
    validadeAlterada,
    handleFormChange,
    handleSubmit,
    resetForm,
    startEdit,
    openInativar,
    handleAtivar,
    motivoState,
    closeMotivo,
    handleMotivoChange,
    handleMotivoSubmit,
    regrasState,
    openRegras,
    closeRegras,
    handleRegraChange,
    handleRegraSubmit,
    openRemoverRegra,
    pessoaBusca,
    pessoaSugestoes,
    pessoaBuscando,
    handlePessoaBuscaChange,
    handlePessoaSelect,
    historicoState,
    openHistorico,
    closeHistorico,
    configForm,
    configSaving,
    configFeedback,
    handleConfigChange,
    handleConfigSubmit,
    reload: loadRequisitos,
  }
}
