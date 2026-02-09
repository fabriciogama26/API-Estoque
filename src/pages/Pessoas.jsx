import { useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { PeopleIcon, SpreadsheetIcon, RefreshIcon } from '../components/icons.jsx'
import { PessoasForm } from '../components/Pessoas/PessoasForm.jsx'
import { PessoasFilters } from '../components/Pessoas/PessoasFilters.jsx'
import { PessoasTable } from '../components/Pessoas/PessoasTable.jsx'
import { PessoasHistoryModal } from '../components/Pessoas/PessoasHistoryModal.jsx'
import { PessoasDesligamentoModal } from '../components/Pessoas/PessoasDesligamentoModal.jsx'
import { PessoasCadastroMassaModal } from '../components/Pessoas/PessoasCadastroMassaModal.jsx'
import { PessoaNomeIgualModal } from '../components/Pessoas/Modal/PessoaNomeIgualModal.jsx'
import { PessoaDetailsModal } from '../components/Pessoas/Modal/PessoaDetailsModal.jsx'
import { PessoaCancelModal } from '../components/Pessoas/Modal/PessoaCancelModal.jsx'
import { PessoasResumoCards } from '../components/PessoasResumoCards.jsx'
import { PessoasProvider, usePessoasContext } from '../context/PessoasContext.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import {
  downloadDesligamentoTemplate,
  importDesligamentoPlanilha,
  downloadCadastroTemplate,
  importCadastroPlanilha,
} from '../services/pessoasService.js'
import { downloadPessoasCsv, formatDate, formatDateTime } from '../utils/pessoasUtils.js'

import '../styles/PessoasPage.css'
import '../styles/MateriaisPage.css'

function PessoasContent() {
  const [detalheState, setDetalheState] = useState({ open: false, pessoa: null })
  const [desligamentoOpen, setDesligamentoOpen] = useState(false)
  const [desligamentoInfo, setDesligamentoInfo] = useState(null)
  const [desligamentoLoading, setDesligamentoLoading] = useState(false)
  const [cadastroMassaOpen, setCadastroMassaOpen] = useState(false)
  const [cadastroMassaInfo, setCadastroMassaInfo] = useState(null)
  const [cadastroMassaLoading, setCadastroMassaLoading] = useState(false)
  const [cadastroMassaAction, setCadastroMassaAction] = useState(null)

  const {
    form,
    filters,
    pessoasOrdenadas,
    pessoasAtivas,
    resumo,
    editingPessoa,
    historyState,
    isSaving,
    isLoading,
    error,
    centrosServico,
    setores,
    cargos,
    tiposExecucao,
    formOptions,
    handleFormChange,
    handleSubmit,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    startEdit,
    cancelEdit,
    openHistory,
    closeHistory,
    cancelState,
    openCancelModal,
    closeCancelModal,
    handleCancelObservationChange,
    handleCancelSubmit,
    loadPessoas,
    nomeDiffPrompt,
    cancelNomeDiff,
    confirmNomeDiff,
  } = usePessoasContext()

  const handleOpenDetalhes = (pessoa) => setDetalheState({ open: true, pessoa })
  const handleCloseDetalhes = () => setDetalheState({ open: false, pessoa: null })
  const handleExportCsv = () => {
    const filename = `pessoas-${new Date().toISOString().slice(0, 10)}.csv`
    downloadPessoasCsv(pessoasOrdenadas, { filename })
  }

  return (
    <div className="stack">
      <PageHeader
        icon={<PeopleIcon size={28} />}
        title="Pessoas"
        subtitle="Registre e atualize colaboradores com historico de edicoes."
        actions={<HelpButton topic="pessoas" />}
      />

      <PessoasForm
        form={form}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        editingPessoa={editingPessoa}
        onCancel={cancelEdit}
        error={error}
        options={formOptions}
        onOpenDesligamento={() => setDesligamentoOpen(true)}
        onOpenCadastroMassa={() => setCadastroMassaOpen(true)}
      />

      <PessoasFilters
        filters={filters}
        centrosServico={centrosServico}
        setores={setores}
        cargos={cargos}
        tiposExecucao={tiposExecucao}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
      />

      <PessoasResumoCards
        pessoas={pessoasAtivas}
        selectedCentro={filters.centroServico ?? filters.local ?? ''}
        selectedSetor={filters.setor ?? ''}
        resumo={resumo}
      />

      <section className="card">
        <header className="card__header">
          <h2>Registros de Pessoas</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="button button--ghost"
              onClick={handleExportCsv}
              aria-label="Exportar lista de pessoas em CSV"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <SpreadsheetIcon size={16} />
              <span>Exportar Excel (CSV)</span>
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => loadPessoas(filters, true)}
              disabled={isLoading}
              aria-label="Atualizar lista de pessoas"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshIcon size={16} />
              <span>Atualizar</span>
            </button>
          </div>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        <PessoasTable
          pessoas={pessoasOrdenadas}
          editingId={editingPessoa?.id ?? null}
          isSaving={isSaving}
          onEdit={startEdit}
          onHistory={openHistory}
          onDetalhes={handleOpenDetalhes}
          onCancel={openCancelModal}
          historyState={historyState}
          cancelState={cancelState}
        />
      </section>

      <PessoaNomeIgualModal
        open={Boolean(nomeDiffPrompt?.open)}
        details={nomeDiffPrompt?.details}
        onCancel={cancelNomeDiff}
        onConfirm={confirmNomeDiff}
      />

      <PessoaDetailsModal
        open={detalheState.open}
        pessoa={detalheState.pessoa}
        onClose={handleCloseDetalhes}
        formatDate={formatDate}
        formatDateTime={formatDateTime}
      />

      <PessoasHistoryModal state={historyState} onClose={closeHistory} />
      <PessoaCancelModal
        state={cancelState}
        onClose={closeCancelModal}
        onConfirm={handleCancelSubmit}
        onObservationChange={handleCancelObservationChange}
        isSaving={cancelState.isSubmitting}
      />
      <PessoasDesligamentoModal
        open={desligamentoOpen}
        onClose={() => {
          setDesligamentoOpen(false)
          setDesligamentoInfo(null)
          setDesligamentoLoading(false)
        }}
        info={desligamentoInfo}
        disabled={desligamentoLoading}
        loading={desligamentoLoading}
        onDownloadTemplate={async () => {
          setDesligamentoInfo({ status: 'info', message: 'Baixando modelo...' })
          try {
            const { blob, filename } = await downloadDesligamentoTemplate()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename || 'desligamento_template.xlsx'
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
            setDesligamentoInfo({ status: 'success', message: 'Modelo baixado com sucesso.' })
          } catch (err) {
            setDesligamentoInfo({ status: 'error', message: err.message || 'Falha ao baixar modelo.' })
          }
        }}
        onUploadFile={async (file) => {
          if (!file) return
          setDesligamentoLoading(true)
          setDesligamentoInfo({ status: 'info', message: 'Enviando planilha...' })
          try {
            const result = await importDesligamentoPlanilha(file)
            setDesligamentoInfo({
              status: 'success',
              message: 'Importacao concluida.',
              stats: {
                processed: result?.processed ?? result?.total ?? 0,
                success: result?.success ?? result?.imported ?? 0,
                errors: result?.errors ?? result?.failed ?? 0,
                skipped: Array.isArray(result?.skipped) ? result.skipped.length : 0,
              },
              skipped: result?.skipped ?? [],
              errorsUrl: result?.errorsUrl ?? null,
              firstError: result?.firstError ?? null,
              errorSamples: result?.errorSamples ?? [],
            })
            await loadPessoas(filters, true)
          } catch (err) {
            setDesligamentoInfo({
              status: 'error',
              message: err.message || 'Falha ao importar planilha.',
            })
          } finally {
            setDesligamentoLoading(false)
          }
        }}
      />
      <PessoasCadastroMassaModal
        open={cadastroMassaOpen}
        onClose={() => {
          setCadastroMassaOpen(false)
          setCadastroMassaInfo(null)
          setCadastroMassaLoading(false)
          setCadastroMassaAction(null)
        }}
        info={cadastroMassaInfo}
        disabled={cadastroMassaLoading}
        loading={cadastroMassaLoading}
        loadingAction={cadastroMassaAction}
        onDownloadTemplate={async () => {
          setCadastroMassaInfo({ status: 'info', message: 'Baixando modelo...' })
          try {
            const { blob, filename } = await downloadCadastroTemplate()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename || 'cadastro_template.xlsx'
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
            setCadastroMassaInfo({ status: 'success', message: 'Modelo baixado com sucesso.' })
          } catch (err) {
            setCadastroMassaInfo({ status: 'error', message: err.message || 'Falha ao baixar modelo.' })
          }
        }}
        onUploadFile={async (file) => {
          if (!file) return
          setCadastroMassaAction('insert')
          setCadastroMassaLoading(true)
          setCadastroMassaInfo({ status: 'info', message: 'Enviando planilha...' })
          try {
            const result = await importCadastroPlanilha(file, { mode: 'insert' })
            setCadastroMassaInfo({
              status: 'success',
              message: 'Importacao concluida.',
              mode: 'insert',
              stats: {
                processed: result?.processed ?? result?.total ?? 0,
                success: result?.success ?? result?.imported ?? 0,
                errors: result?.errors ?? result?.failed ?? 0,
              },
              errorsUrl: result?.errorsUrl ?? null,
              firstError: result?.firstError ?? null,
              errorSamples: result?.errorSamples ?? [],
            })
            await loadPessoas(filters, true)
          } catch (err) {
            setCadastroMassaInfo({
              status: 'error',
              message: err.message || 'Falha ao importar planilha.',
              mode: 'insert',
            })
          } finally {
            setCadastroMassaLoading(false)
            setCadastroMassaAction(null)
          }
        }}
        onUpdateFile={async (file) => {
          if (!file) return
          setCadastroMassaAction('update')
          setCadastroMassaLoading(true)
          setCadastroMassaInfo({ status: 'info', message: 'Enviando planilha...' })
          try {
            const result = await importCadastroPlanilha(file, { mode: 'update' })
            setCadastroMassaInfo({
              status: 'success',
              message: 'Atualizacao concluida.',
              mode: 'update',
              stats: {
                processed: result?.processed ?? result?.total ?? 0,
                success: result?.success ?? result?.imported ?? 0,
                errors: result?.errors ?? result?.failed ?? 0,
              },
              errorsUrl: result?.errorsUrl ?? null,
              firstError: result?.firstError ?? null,
              errorSamples: result?.errorSamples ?? [],
            })
            await loadPessoas(filters, true)
          } catch (err) {
            setCadastroMassaInfo({
              status: 'error',
              message: err.message || 'Falha ao atualizar planilha.',
              mode: 'update',
            })
          } finally {
            setCadastroMassaLoading(false)
            setCadastroMassaAction(null)
          }
        }}
      />
    </div>
  )
}

export function PessoasPage() {
  return (
    <PessoasProvider>
      <PessoasContent />
    </PessoasProvider>
  )
}
