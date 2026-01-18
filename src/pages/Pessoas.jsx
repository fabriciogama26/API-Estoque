import { useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { CancelIcon, PeopleIcon } from '../components/icons.jsx'
import { PessoasForm } from '../components/Pessoas/PessoasForm.jsx'
import { PessoasFilters } from '../components/Pessoas/PessoasFilters.jsx'
import { PessoasTable } from '../components/Pessoas/PessoasTable.jsx'
import { PessoasHistoryModal } from '../components/Pessoas/PessoasHistoryModal.jsx'
import { PessoasDesligamentoModal } from '../components/Pessoas/PessoasDesligamentoModal.jsx'
import { PessoasResumoCards } from '../components/PessoasResumoCards.jsx'
import { PessoasProvider, usePessoasContext } from '../context/PessoasContext.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { downloadDesligamentoTemplate, importDesligamentoPlanilha } from '../services/pessoasService.js'
import { formatDate, formatDateTime } from '../utils/pessoasUtils.js'

import '../styles/PessoasPage.css'
import '../styles/MateriaisPage.css'

function PessoasContent() {
  const [detalheState, setDetalheState] = useState({ open: false, pessoa: null })
  const [desligamentoOpen, setDesligamentoOpen] = useState(false)
  const [desligamentoInfo, setDesligamentoInfo] = useState(null)
  const [desligamentoLoading, setDesligamentoLoading] = useState(false)

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
    resetForm,
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
          <h2>Lista de pessoas</h2>
          <button type="button" className="button button--ghost" onClick={() => loadPessoas(filters, true)} disabled={isLoading}>
            Atualizar
          </button>
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

      {nomeDiffPrompt?.open ? (
        <div className="modal__overlay" role="dialog" aria-modal="true">
          <div className="modal__content" onClick={(event) => event.stopPropagation()}>
            <header className="modal__header">
              <h3>Pessoa com nome igual</h3>
              <button type="button" className="modal__close" onClick={cancelNomeDiff} aria-label="Fechar">
                x
              </button>
            </header>
            <div className="modal__body">
              <p className="feedback feedback--warning">
                Já existe pessoa com o mesmo nome mas com matrícula diferente. Deseja salvar mesmo assim?
              </p>
              {Array.isArray(nomeDiffPrompt.details) && nomeDiffPrompt.details.length ? (
                <div className="card card--muted" style={{ marginTop: '0.5rem' }}>
                  <strong>IDs encontrados:</strong>
                  <ul style={{ margin: '0.5rem 0 0 1rem' }}>
                    {nomeDiffPrompt.details.map((id) => (
                      <li key={id} style={{ wordBreak: 'break-all' }}>
                        {id}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <footer className="modal__footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="button button--ghost" onClick={cancelNomeDiff}>
                Cancelar
              </button>
              <button type="button" className="button" onClick={confirmNomeDiff}>
                Salvar mesmo assim
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {detalheState.open && detalheState.pessoa ? (
        <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={handleCloseDetalhes}>
          <div className="saida-details__modal" onClick={(event) => event.stopPropagation()}>
            <header className="saida-details__header">
              <div>
                <p className="saida-details__eyebrow">ID da pessoa</p>
                <h3 className="saida-details__title">{detalheState.pessoa.id || 'ID nao informado'}</h3>
              </div>
              <button
                type="button"
                className="saida-details__close"
                onClick={handleCloseDetalhes}
                aria-label="Fechar detalhes"
              >
                <CancelIcon size={18} />
              </button>
            </header>

            <div className="saida-details__section">
              <h4 className="saida-details__section-title">Dados principais</h4>
              <div className="saida-details__grid">
                <div className="saida-details__item">
                  <span className="saida-details__label">Nome</span>
                  <p className="saida-details__value">{detalheState.pessoa.nome || '-'}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Matricula</span>
                  <p className="saida-details__value">{detalheState.pessoa.matricula || '-'}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Centro de servico</span>
                  <p className="saida-details__value">
                    {detalheState.pessoa.centroServico || detalheState.pessoa.local || '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Setor</span>
                  <p className="saida-details__value">{detalheState.pessoa.setor || '-'}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Cargo</span>
                  <p className="saida-details__value">{detalheState.pessoa.cargo || '-'}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Tipo execucao</span>
                  <p className="saida-details__value">{detalheState.pessoa.tipoExecucao || '-'}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Status</span>
                  <p className="saida-details__value">
                    {detalheState.pessoa.ativo === false ? 'Inativo' : 'Ativo'}
                  </p>
                </div>
              </div>
            </div>

            <div className="saida-details__section">
              <h4 className="saida-details__section-title">Datas</h4>
              <div className="saida-details__grid">
                <div className="saida-details__item">
                  <span className="saida-details__label">Data de admissao</span>
                  <p className="saida-details__value">{formatDate(detalheState.pessoa.dataAdmissao)}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Data de demissao</span>
                  <p className="saida-details__value">{formatDate(detalheState.pessoa.dataDemissao)}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Cadastrado em</span>
                  <p className="saida-details__value">{formatDateTime(detalheState.pessoa.criadoEm)}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Atualizado em</span>
                  <p className="saida-details__value">{formatDateTime(detalheState.pessoa.atualizadoEm)}</p>
                </div>
              </div>
            </div>

            <div className="saida-details__section">
              <h4 className="saida-details__section-title">Registro</h4>
              <div className="saida-details__grid">
                <div className="saida-details__item">
                  <span className="saida-details__label">Registrado por</span>
                  <p className="saida-details__value">
                    {detalheState.pessoa.usuarioCadastroNome ||
                      detalheState.pessoa.usuarioCadastroUsername ||
                      detalheState.pessoa.usuarioCadastro ||
                      '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Ultima edicao</span>
                  <p className="saida-details__value">
                    {detalheState.pessoa.usuarioEdicaoNome ||
                      detalheState.pessoa.usuarioEdicao ||
                      detalheState.pessoa.usuarioEdicaoId ||
                      '-'}
                  </p>
                </div>
              </div>
            </div>

            <footer className="saida-details__footer">
              <button type="button" className="button button--ghost" onClick={handleCloseDetalhes}>
                Fechar
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <PessoasHistoryModal state={historyState} onClose={closeHistory} />
      {cancelState.open ? (
        <div className="modal__overlay" role="dialog" aria-modal="true" onClick={closeCancelModal}>
          <div className="modal__content" onClick={(event) => event.stopPropagation()}>
            <header className="modal__header">
              <h3>Cancelar pessoa</h3>
              <button type="button" className="modal__close" onClick={closeCancelModal} aria-label="Fechar">
                <CancelIcon size={18} />
              </button>
            </header>
            <div className="modal__body">
              <p>
                Marcar {cancelState.pessoa?.nome || 'esta pessoa'} como inativa? Ela deixa de aparecer nas metricas e paineis.
              </p>
              <p className="field__hint">Voce pode reativar editando a pessoa futuramente.</p>
              <label className="field">
                <span>Observacao <span className="asterisco">*</span></span>
                <textarea
                  rows={3}
                  value={cancelState.observacao}
                  onChange={(e) => handleCancelObservationChange(e.target.value)}
                  placeholder="Descreva o motivo do cancelamento"
                  required
                />
              </label>
              {cancelState.error ? <p className="feedback feedback--error">{cancelState.error}</p> : null}
            </div>
            <footer className="modal__footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={closeCancelModal}
                disabled={cancelState.isSubmitting}
              >
                Fechar
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={handleCancelSubmit}
                disabled={cancelState.isSubmitting || !cancelState.observacao.trim()}
              >
                {cancelState.isSubmitting ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
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
