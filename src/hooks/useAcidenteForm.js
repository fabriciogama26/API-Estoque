import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  validateAcidenteForm,
  createAcidentePayload,
  updateAcidentePayload,
} from '../rules/AcidentesRules.js'
import {
  toInputDateTime,
  parseList,
  normalizeAgenteKey,
  normalizeAgenteNome,
  extractAgenteNome,
} from '../utils/acidentesUtils.js'
import {
  createAcidente,
  updateAcidente,
  listLesoesPorAgente,
  listTiposPorAgente,
} from '../services/acidentesService.js'
import { ACIDENTES_FORM_DEFAULT } from '../config/AcidentesConfig.js'

export function useAcidenteForm({
  pessoas = [],
  locais = [],
  agenteOpcoes = [],
  onSaved,
  onError,
}) {
  const { user } = useAuth()

  const [form, setForm] = useState(() => ({ ...ACIDENTES_FORM_DEFAULT }))
  const [editingAcidente, setEditingAcidente] = useState(null)
  const [formError, setFormError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const [tipoOpcoes, setTipoOpcoes] = useState([])
  const [tiposError, setTiposError] = useState(null)
  const [isLoadingTipos, setIsLoadingTipos] = useState(false)

  const [lesaoOpcoes, setLesaoOpcoes] = useState([])
  const [lesoesError, setLesoesError] = useState(null)
  const [isLoadingLesoes, setIsLoadingLesoes] = useState(false)

  const pessoasPorMatricula = useMemo(() => {
    const map = new Map()
    pessoas.forEach((pessoa) => {
      if (!pessoa?.matricula) {
        return
      }
      map.set(String(pessoa.matricula), pessoa)
    })
    return map
  }, [pessoas])

  const centrosServicoPessoas = useMemo(() => {
    const valores = new Set()
    pessoas.forEach((pessoa) => {
      const centro = (pessoa?.centroServico ?? pessoa?.setor ?? '').trim()
      if (!centro) {
        return
      }
      valores.add(centro)
    })
    return Array.from(valores).sort((a, b) => a.localeCompare(b))
  }, [pessoas])

  const resolveLocalDisponivel = useCallback(
    (valor) => {
      const alvo = valor?.trim()
      if (!alvo) {
        return ''
      }
      const matchDireto = locais.find((item) => item === alvo)
      if (matchDireto) {
        return matchDireto
      }
      const normalizar = (texto) =>
        texto
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      const alvoNormalizado = normalizar(alvo)
      return locais.find((item) => normalizar(item) === alvoNormalizado) ?? ''
    },
    [locais],
  )

  const agenteSelecionadoInfo = useMemo(() => {
    const alvo = normalizeAgenteKey(form.agente ?? '')
    if (!alvo) {
      return null
    }
    return (
      agenteOpcoes.find((item) => {
        if (!item) {
          return false
        }
        const nomeItem = extractAgenteNome(item)
        return normalizeAgenteKey(nomeItem) === alvo
      }) ?? null
    )
  }, [agenteOpcoes, form.agente])

  const agenteAtualPayload = useMemo(() => {
    const nome = normalizeAgenteNome(form.agente)
    if (agenteSelecionadoInfo && typeof agenteSelecionadoInfo === 'object') {
      const nomeOficial = normalizeAgenteNome(
        agenteSelecionadoInfo.nome ?? extractAgenteNome(agenteSelecionadoInfo),
      )
      const payloadNome = nomeOficial || nome
      return {
        nome: payloadNome,
        id: agenteSelecionadoInfo.id ?? agenteSelecionadoInfo.agenteId ?? null,
      }
    }
    if (nome) {
      return { nome, id: null }
    }
    return null
  }, [agenteSelecionadoInfo, form.agente])

  useEffect(() => {
    let cancelado = false
    if (!agenteAtualPayload) {
      setLesaoOpcoes([])
      setLesoesError(null)
      setIsLoadingLesoes(false)
      return () => {
        cancelado = true
      }
    }
    const fetchLesoes = async () => {
      setIsLoadingLesoes(true)
      setLesoesError(null)
      setLesaoOpcoes([])
      try {
        const response = await listLesoesPorAgente(agenteAtualPayload)
        if (!cancelado) {
          setLesaoOpcoes(Array.isArray(response) ? response : [])
        }
      } catch (err) {
        if (!cancelado) {
          setLesoesError(err.message)
          setLesaoOpcoes([])
        }
      } finally {
        if (!cancelado) {
          setIsLoadingLesoes(false)
        }
      }
    }
    fetchLesoes()
    return () => {
      cancelado = true
    }
  }, [agenteAtualPayload])

  useEffect(() => {
    if (!agenteAtualPayload) {
      setTipoOpcoes([])
      setTiposError(null)
      setIsLoadingTipos(false)
      return
    }
    let cancelado = false
    setIsLoadingTipos(true)
    setTiposError(null)
    setTipoOpcoes([])
    listTiposPorAgente(agenteAtualPayload)
      .then((lista) => {
        if (!cancelado) {
          setTipoOpcoes(Array.isArray(lista) ? lista : [])
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setTiposError(err.message)
          setTipoOpcoes([])
        }
      })
      .finally(() => {
        if (!cancelado) {
          setIsLoadingTipos(false)
        }
      })
    return () => {
      cancelado = true
    }
  }, [agenteAtualPayload])

  const resetForm = useCallback(() => {
    setForm({ ...ACIDENTES_FORM_DEFAULT })
    setEditingAcidente(null)
    setTipoOpcoes([])
    setTiposError(null)
    setIsLoadingTipos(false)
    setLesoesError(null)
  }, [])

  const handleFormChange = useCallback(
    (event) => {
      const { name, type } = event.target
      const value =
        type === 'checkbox' && typeof event.target.checked === 'boolean'
          ? event.target.checked
          : event.target.value
      if (name === 'matricula') {
        setForm((prev) => {
          const next = { ...prev, matricula: value }
          const pessoa = pessoasPorMatricula.get(value)
          if (pessoa) {
            next.nome = pessoa.nome ?? ''
            next.cargo = pessoa.cargo ?? ''
            const centroServico = pessoa.centroServico ?? pessoa.setor ?? pessoa.local ?? ''
            next.centroServico = centroServico
            next.setor = centroServico
            const localBase = pessoa.local ?? centroServico
            next.local = resolveLocalDisponivel(localBase)
          } else if (!value) {
            next.nome = ''
            next.cargo = ''
            next.centroServico = ''
            next.setor = ''
            next.local = ''
          }
          return next
        })
        return
      }
      if (name === 'agentes') {
        const lista = Array.isArray(value)
          ? value
              .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
              .filter(Boolean)
          : parseList(value)
        let agenteAlterado = false
        setForm((prev) => {
          const agenteAtual = lista.length ? lista[lista.length - 1] : ''
          const chaveAtual = normalizeAgenteKey(agenteAtual)
          const chaveAnterior = normalizeAgenteKey(prev.agente ?? '')
          agenteAlterado = chaveAtual !== chaveAnterior
          const next = { ...prev, agentes: lista, agente: agenteAtual }
          if (!lista.length) {
            next.tipos = []
            next.tipo = ''
            next.lesoes = []
            next.lesao = ''
          }
          return next
        })
        if (!lista.length) {
          setTipoOpcoes([])
          setTiposError(null)
          setLesaoOpcoes([])
          setLesoesError(null)
        }
        if (agenteAlterado) {
          setTipoOpcoes([])
          setTiposError(null)
          setLesaoOpcoes([])
          setLesoesError(null)
        }
        return
      }
      if (name === 'agente') {
        let alterou = false
        setForm((prev) => {
          if (prev.agente === value) {
            alterou = false
            return prev
          }
          const chaveAnterior = normalizeAgenteKey(prev.agente ?? '')
          const chaveAtual = normalizeAgenteKey(value)
          alterou = chaveAnterior !== chaveAtual
          const next = { ...prev, agente: value }
          if (!value) {
            next.tipos = []
            next.tipo = ''
            next.lesoes = []
            next.lesao = ''
          }
          return next
        })
        if (!value || alterou) {
          setTipoOpcoes([])
          setTiposError(null)
          setLesaoOpcoes([])
          setLesoesError(null)
        }
        return
      }
      if (name === 'tipo') {
        setForm((prev) => ({ ...prev, tipo: value }))
        return
      }
      if (name === 'tipos') {
        const lista = Array.isArray(value)
          ? value.map((item) => (item === undefined || item === null ? '' : String(item).trim())).filter(Boolean)
          : parseList(value)
        setForm((prev) => ({ ...prev, tipos: lista, tipo: lista.join('; ') }))
        return
      }
      if (name === 'lesoes') {
        const lista = Array.isArray(value)
          ? value.filter((item) => item && item.trim())
          : typeof value === 'string' && value
            ? [value.trim()].filter(Boolean)
            : []
        setForm((prev) => ({ ...prev, lesoes: lista, lesao: lista[0] ?? '' }))
        return
      }
      if (name === 'partesLesionadas') {
        const lista = Array.isArray(value)
          ? value.filter((item) => item && item.trim())
          : typeof value === 'string' && value
          ? [value.trim()].filter(Boolean)
          : []
        setForm((prev) => ({ ...prev, partesLesionadas: lista }))
        return
      }
      if (name === 'local') {
        setForm((prev) => ({ ...prev, local: resolveLocalDisponivel(value) }))
        return
      }
      if (name === 'centroServico') {
        setForm((prev) => ({ ...prev, centroServico: value, setor: value }))
        return
      }
      setForm((prev) => ({ ...prev, [name]: value }))
    },
    [pessoasPorMatricula, resolveLocalDisponivel],
  )

  const startEdit = useCallback(
    (acidente) => {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      setEditingAcidente(acidente)
      const lesoesSelecionadas =
        Array.isArray(acidente.lesoes) && acidente.lesoes.length
          ? acidente.lesoes.slice()
          : acidente.lesao
            ? [acidente.lesao]
            : []
      const agentesSelecionados = parseList(acidente.agentes?.length ? acidente.agentes : acidente.agente)
      const tiposSelecionados = parseList(acidente.tipos?.length ? acidente.tipos : acidente.tipo)
      setForm({
        matricula: acidente.matricula || '',
        nome: acidente.nome || '',
        cargo: acidente.cargo || '',
        data: toInputDateTime(acidente.data),
        diasPerdidos: acidente.diasPerdidos !== null && acidente.diasPerdidos !== undefined ? String(acidente.diasPerdidos) : '',
        diasDebitados:
          acidente.diasDebitados !== null && acidente.diasDebitados !== undefined ? String(acidente.diasDebitados) : '',
        tipo: tiposSelecionados.join('; '),
        tipos: tiposSelecionados,
        agente: agentesSelecionados[agentesSelecionados.length - 1] || '',
        agentes: agentesSelecionados,
        cid: acidente.cid || '',
        lesao: lesoesSelecionadas[0] || '',
        lesoes: lesoesSelecionadas,
        parteLesionada: acidente.parteLesionada || '',
        hht:
          acidente.hht !== null && acidente.hht !== undefined ? String(acidente.hht) : '',
        centroServico: acidente.centroServico || acidente.setor || '',
        setor: acidente.centroServico || acidente.setor || '',
        local: resolveLocalDisponivel(acidente.local || acidente.centroServico || ''),
        partesLesionadas:
          Array.isArray(acidente.partesLesionadas) && acidente.partesLesionadas.length
            ? acidente.partesLesionadas.slice()
            : acidente.parteLesionada
              ? [acidente.parteLesionada]
              : [],
        cat: acidente.cat || '',
        observacao: acidente.observacao || '',
        dataEsocial: acidente.dataEsocial || '',
        sesmt: Boolean(acidente.sesmt),
        dataSesmt: acidente.dataSesmt || '',
      })
      setTipoOpcoes([])
      setTiposError(null)
    },
    [resolveLocalDisponivel],
  )

  const cancelEdit = useCallback(() => {
    resetForm()
  }, [resetForm])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      setFormError(null)

      const validationError = validateAcidenteForm(form)
      if (validationError) {
        setFormError(validationError)
        return
      }

      setIsSaving(true)

      try {
        const usuario = user?.name || user?.username || user?.email || 'sistema'

        if (editingAcidente) {
          await updateAcidente(editingAcidente.id, updateAcidentePayload(form, usuario))
        } else {
          await createAcidente(createAcidentePayload(form, usuario))
        }

        resetForm()
        if (typeof onSaved === 'function') {
          await onSaved()
        }
      } catch (err) {
        setFormError(err.message)
        if (typeof onError === 'function') {
          onError(err, { form })
        }
      } finally {
        setIsSaving(false)
      }
    },
    [editingAcidente, form, onError, onSaved, resetForm, user],
  )

  return {
    form,
    setForm,
    formError,
    isSaving,
    handleFormChange,
    handleSubmit,
    startEdit,
    cancelEdit,
    resetForm,
    editingAcidente,
    tipoOpcoes,
    tiposError,
    isLoadingTipos,
    lesaoOpcoes,
    lesoesError,
    isLoadingLesoes,
    centrosServicoPessoas,
  }
}
