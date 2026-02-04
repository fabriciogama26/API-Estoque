import { useCallback, useMemo, useState } from 'react'
import { fetchRelatoriosEstoque, generateRelatorioEstoquePdf } from '../services/relatorioEstoqueApi.js'
import { downloadRelatorioEstoquePdf } from '../utils/RelatorioEstoquePdfUtils.js'
import { PDF_REPORT_LIMIT_PER_MONTH } from '../config/RelatorioEstoqueConfig.js'
import { useErrorLogger } from './useErrorLogger.js'

const CURRENT_YEAR = new Date().getFullYear()

const initialFilters = {
  tipo: 'mensal',
  mes: '',
  trimestre: '1',
  ano: `${CURRENT_YEAR}`,
}

const isSameMonth = (value, reference) => {
  if (!value || !reference) return false
  const dateA = new Date(value)
  const dateB = new Date(reference)
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return false
  return dateA.getUTCFullYear() === dateB.getUTCFullYear() && dateA.getUTCMonth() === dateB.getUTCMonth()
}

export function useRelatorioEstoque() {
  const { reportError } = useErrorLogger('relatorio_estoque')
  const [filters, setFilters] = useState(initialFilters)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState({ html: '', report: null })
  const [pdfLoadingId, setPdfLoadingId] = useState(null)

  const canGeneratePdf = useCallback((report) => {
    if (!report?.pdf_gerado_em) return true
    if (PDF_REPORT_LIMIT_PER_MONTH <= 0) return true
    return !isSameMonth(report.pdf_gerado_em, new Date())
  }, [])

  const buildParams = useCallback(
    (nextFilters) => {
      const params = { tipo: nextFilters.tipo }
      if (nextFilters.tipo === 'mensal' && nextFilters.mes) {
        params.mes = nextFilters.mes
      }
      if (nextFilters.tipo === 'trimestral') {
        params.trimestre = nextFilters.trimestre
        params.ano = nextFilters.ano
      }
      return params
    },
    []
  )

  const loadReports = useCallback(
    async (nextFilters) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetchRelatoriosEstoque(buildParams(nextFilters))
        setReports(response?.items ?? [])
      } catch (err) {
        setError(err?.message || 'Falha ao carregar relatorios.')
        reportError(err, { area: 'listar_relatorios' })
      } finally {
        setLoading(false)
      }
    },
    [buildParams, reportError]
  )

  const handleChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    loadReports(filters)
  }

  const handleReset = () => {
    setFilters(initialFilters)
    setReports([])
    setPreview({ html: '', report: null })
    setError(null)
  }

  const handleGeneratePdf = async (report) => {
    if (!report?.id) return
    if (!canGeneratePdf(report)) {
      setError('PDF ja gerado para este relatorio no mes atual.')
      return
    }
    setPdfLoadingId(report.id)
    setError(null)
    try {
      const response = await generateRelatorioEstoquePdf({ reportId: report.id })
      const html = response?.html || ''
      const updatedPdfDate = response?.pdfGeradoEm || new Date().toISOString()
      setPreview({ html, report })
      setReports((prev) =>
        prev.map((item) => (item.id === report.id ? { ...item, pdf_gerado_em: updatedPdfDate } : item))
      )
      if (html) {
        await downloadRelatorioEstoquePdf({ html, report })
      }
    } catch (err) {
      setError(err?.message || 'Falha ao gerar PDF.')
      reportError(err, { area: 'gerar_pdf', reportId: report.id })
    } finally {
      setPdfLoadingId(null)
    }
  }

  const hasReports = useMemo(() => reports.length > 0, [reports])

  return {
    filters,
    reports,
    loading,
    error,
    preview,
    pdfLoadingId,
    hasReports,
    canGeneratePdf,
    handleChange,
    handleSubmit,
    handleReset,
    handleGeneratePdf,
  }
}
