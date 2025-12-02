import { useCallback, useMemo, useState } from 'react'
import { fetchTermoEpiContext } from '../services/termoEpiService.js'
import { downloadTermoEpiPdf } from '../utils/TermoEpiUtils.js'
import { buildEpiTermHtml } from '../../shared/documents/epiTermTemplate.js'
import { logError } from '../services/errorLogService.js'

const INITIAL_FORM = {
  matricula: '',
  nome: '',
  dataInicio: '',
  dataFim: '',
}

const INITIAL_PREVIEW = {
  isLoading: false,
  error: null,
  context: null,
  html: '',
}

export function useTermoEpi() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [preview, setPreview] = useState(INITIAL_PREVIEW)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleChange = useCallback((event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleReset = useCallback(() => {
    setForm(INITIAL_FORM)
    setPreview(INITIAL_PREVIEW)
  }, [])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      const matricula = form.matricula.trim()
      const nome = form.nome.trim()
      const dataInicio = form.dataInicio
      const dataFim = form.dataFim

      const dataInicioDate = dataInicio ? new Date(`${dataInicio}T00:00:00`) : null
      const dataFimDate = dataFim ? new Date(`${dataFim}T23:59:59`) : null
      if (
        (dataInicioDate && Number.isNaN(dataInicioDate.getTime())) ||
        (dataFimDate && Number.isNaN(dataFimDate.getTime()))
      ) {
        setPreview({
          ...INITIAL_PREVIEW,
          error: 'Datas informadas sao invalidas.',
        })
        return
      }

      if (dataInicioDate && dataFimDate && dataInicioDate > dataFimDate) {
        setPreview({
          ...INITIAL_PREVIEW,
          error: 'Data inicial nao pode ser maior que a data final.',
        })
        return
      }

      if (!matricula && !nome) {
        setPreview({
          ...INITIAL_PREVIEW,
          error: 'Informe a matricula ou o nome do colaborador.',
        })
        return
      }

      setPreview({
        ...INITIAL_PREVIEW,
        isLoading: true,
        error: null,
      })

      try {
        const query = {
          ...(matricula ? { matricula } : { nome }),
          ...(dataInicio ? { dataInicio } : {}),
          ...(dataFim ? { dataFim } : {}),
        }
        const contexto = await fetchTermoEpiContext(query)
        const html = buildEpiTermHtml(contexto)
        setPreview({
          isLoading: false,
          error: null,
          context: contexto,
          html,
        })
      } catch (err) {
        setPreview({
          ...INITIAL_PREVIEW,
          error: err.message || 'Nao foi possivel gerar o termo.',
        })
        logError({
          page: 'termo-epi',
          message: err.message,
          context: { query: { ...form } },
          severity: 'error',
        })
      }
    },
    [form]
  )

  const handleDownload = useCallback(async () => {
    if (!preview.context || !preview.html) {
      return
    }

    try {
      setIsDownloading(true)
      await downloadTermoEpiPdf({ html: preview.html, context: preview.context })
    } catch (err) {
      setPreview((prev) => ({
        ...prev,
        error: err.message || 'Falha ao baixar o PDF.',
      }))
      logError({
        page: 'termo-epi',
        message: err.message,
        context: { action: 'download-pdf' },
        severity: 'error',
      })
    } finally {
      setIsDownloading(false)
    }
  }, [preview.context, preview.html])

  const resumo = useMemo(() => {
    const context = preview.context
    const ultimaEntregaLabel = context?.totais?.ultimaEntrega
      ? new Date(context.totais.ultimaEntrega).toLocaleDateString('pt-BR')
      : '-'
    const origemLabel =
      context?.origem === 'local'
        ? 'Dados locais'
        : context?.origem === 'remoto'
          ? 'Banco (Supabase)'
          : null

    return { context, ultimaEntregaLabel, origemLabel }
  }, [preview.context])

  return {
    form,
    preview,
    isDownloading,
    resumo,
    handleChange,
    handleSubmit,
    handleReset,
    handleDownload,
  }
}
