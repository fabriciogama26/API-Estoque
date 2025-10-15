import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { ChecklistIcon } from '../components/icons.jsx'
import { isLocalMode } from '../config/runtime.js'
import { dataClient as dataApi } from '../services/dataClient.js'
import { buildEpiTermHtml } from '../../shared/documents/epiTermTemplate.js'
import { downloadTermoEpiPdf } from '../utils/TermoEpiUtils.js'
import '../styles/DocumentPreviewModal.css'

const initialForm = {
  matricula: '',
  nome: '',
}

const initialPreview = {
  isLoading: false,
  error: null,
  context: null,
  html: '',
}

export function TermosEpiPage() {
  const [form, setForm] = useState(initialForm)
  const [preview, setPreview] = useState(initialPreview)
  const [lastQuery, setLastQuery] = useState(null)
  const iframeRef = useRef(null)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const matricula = form.matricula.trim()
    const nome = form.nome.trim()

    if (!matricula && !nome) {
      setPreview({
        ...initialPreview,
        error: 'Informe a matricula ou o nome do colaborador.',
      })
      return
    }

    setPreview({
      ...initialPreview,
      isLoading: true,
      error: null,
    })

    try {
      const query = matricula ? { matricula } : { nome }
      const contexto = await dataApi.documentos.termoEpiContext(query)
      const html = buildEpiTermHtml(contexto)
      setPreview({
        isLoading: false,
        error: null,
        context: contexto,
        html,
      })
      setLastQuery(query)
    } catch (err) {
      setPreview({
        ...initialPreview,
        error: err.message || 'Nao foi possivel gerar o termo.',
      })
    }
  }

  const handleDownload = async () => {
    if (!preview.context || !preview.html || !lastQuery) {
      return
    }

    try {
      await downloadTermoEpiPdf({ params: lastQuery })
    } catch (err) {
      setPreview((prev) => ({
        ...prev,
        error: err.message || 'Falha ao baixar o PDF.',
      }))
    }
  }

  const handleReset = () => {
    setForm(initialForm)
    setPreview(initialPreview)
    setLastQuery(null)
  }

  const context = preview.context
  const ultimaEntregaLabel = context?.totais?.ultimaEntrega
    ? new Date(context.totais.ultimaEntrega).toLocaleDateString('pt-BR')
    : '-'
  const origemLabel = context?.origem === 'local' ? 'Dados locais' : context?.origem === 'remoto' ? 'Banco (Supabase)' : null

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.style.height = 'auto'
    }
  }, [preview.html])

  const handleFrameLoad = () => {
    if (!iframeRef.current) {
      return
    }
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
    if (!doc) {
      return
    }
    const height = doc.documentElement.scrollHeight || doc.body.scrollHeight || 0
    iframeRef.current.style.height = `${Math.max(height, 400)}px`
  }

  return (
    <div className="stack">
      <PageHeader
        icon={<ChecklistIcon size={28} />}
        title="Termo de EPI"
        subtitle="Pesquise colaboradores e gere o termo de responsabilidade de EPI."
      />
      <div className="document-preview__mode-indicator">
        <span className={`document-preview__origin${isLocalMode ? ' document-preview__origin--local' : ''}`}>
          {isLocalMode ? 'Modo local (dados do navegador)' : 'Modo online (Supabase)'}
        </span>
      </div>

      <section className="card">
        <header className="card__header">
          <h2>Gerar termo</h2>
        </header>
        <form className="form form--horizontal gap" onSubmit={handleSubmit}>
          <div className="form__row">
            <label className="field">
              <span>Matricula</span>
              <input
                name="matricula"
                value={form.matricula}
                onChange={handleChange}
                placeholder="Ex.: 12345"
              />
            </label>
            <label className="field">
              <span>Nome</span>
              <input
                name="nome"
                value={form.nome}
                onChange={handleChange}
                placeholder="Ex.: Maria Souza"
              />
            </label>
          </div>
          <div className="form__actions">
            <button type="submit" className="button button--primary" disabled={preview.isLoading}>
              {preview.isLoading ? 'Gerando...' : 'Gerar termo'}
            </button>
            <button type="button" className="button button--ghost" onClick={handleReset} disabled={preview.isLoading}>
              Limpar
            </button>
          </div>
        </form>
        {preview.error ? <p className="feedback feedback--error">{preview.error}</p> : null}
      </section>

      <section className="card">
        <header className="card__header">
          <h2>Pre-visualizacao</h2>
          {preview.html ? (
            <button type="button" className="button button--ghost" onClick={handleDownload}>
              Baixar PDF
            </button>
          ) : null}
        </header>
        {preview.isLoading ? (
          <p className="feedback">Carregando documento...</p>
        ) : preview.html ? (
          <div className="document-preview__inline">
            <div className="document-preview__summary">
              <strong>{context?.colaborador?.nome}</strong>
              <span>{context?.colaborador?.centroServico}</span>
              <span>Ultima entrega: {ultimaEntregaLabel}</span>
              <span>Itens entregues: {context?.totais?.totalItensEntregues ?? '-'}</span>
              {origemLabel ? (
                <span className={`document-preview__origin${context?.origem === 'local' ? ' document-preview__origin--local' : ''}`}>
                  {origemLabel}
                </span>
              ) : null}
            </div>
            <iframe
              ref={iframeRef}
              title="Pre-visualizacao do termo de EPI"
              className="document-preview__frame"
              srcDoc={preview.html}
              onLoad={handleFrameLoad}
            />
          </div>
        ) : (
          <p className="feedback">Informe os dados e clique em "Gerar termo" para visualizar o documento.</p>
        )}
      </section>
    </div>
  )
}
