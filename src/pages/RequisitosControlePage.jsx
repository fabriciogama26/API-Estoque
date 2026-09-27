import { PageHeader } from '../components/PageHeader.jsx'
import { ChecklistIcon, RefreshIcon } from '../components/icons.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { RequisitosControleProvider, useRequisitosControleContext } from '../context/RequisitosControleContext.jsx'
import { RequisitoForm } from '../components/Validades/RequisitoForm.jsx'
import { RequisitosTable } from '../components/Validades/RequisitosTable.jsx'
import { RequisitoRegrasModal } from '../components/Validades/RequisitoRegrasModal.jsx'
import { RequisitoHistoricoModal } from '../components/Validades/RequisitoHistoricoModal.jsx'
import { ValidadesConfigCard } from '../components/Validades/ValidadesConfigCard.jsx'
import { ValidadeMotivoModal } from '../components/Validades/ValidadeMotivoModal.jsx'
import { ValidadesIndisponivel } from '../components/Validades/ValidadesIndisponivel.jsx'
import '../styles/MateriaisPage.css'
import '../styles/ValidadesPage.css'

function RequisitosControleContent() {
  const ctx = useRequisitosControleContext()

  if (!ctx.disponivel) {
    return <ValidadesIndisponivel />
  }

  return (
    <>
      {ctx.permissoes.gerenciarRequisitos ? (
        <RequisitoForm
          form={ctx.form}
          editing={ctx.editing}
          isSaving={ctx.isSaving}
          error={ctx.formError}
          validadeAlterada={ctx.validadeAlterada}
          podeAlterarValidade={ctx.permissoes.gerenciarRegras}
          onChange={ctx.handleFormChange}
          onSubmit={ctx.handleSubmit}
          onCancel={ctx.resetForm}
        />
      ) : null}

      <section className="card">
        <header className="card__header">
          <h2>Requisitos cadastrados</h2>
          <button
            type="button"
            className="button button--ghost"
            onClick={ctx.reload}
            disabled={ctx.isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshIcon size={16} />
            <span>{ctx.isLoading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </header>

        <div className="form form--inline validades-toolbar">
          <label className="field">
            <span>Buscar</span>
            <input value={ctx.busca} onChange={(event) => ctx.setBusca(event.target.value)} placeholder="Nome ou codigo" />
          </label>
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={ctx.mostrarInativos}
              onChange={(event) => ctx.setMostrarInativos(event.target.checked)}
            />
            <span>Mostrar inativos</span>
          </label>
        </div>

        {ctx.error ? <p className="feedback feedback--error">{ctx.error}</p> : null}
        {ctx.isLoading && !ctx.totalRequisitos ? <p className="feedback">Carregando...</p> : null}

        <RequisitosTable
          requisitos={ctx.requisitos}
          podeGerenciar={ctx.permissoes.gerenciarRequisitos}
          onEdit={ctx.startEdit}
          onRegras={ctx.openRegras}
          onHistorico={ctx.openHistorico}
          onInativar={ctx.openInativar}
          onAtivar={ctx.handleAtivar}
        />
      </section>

      <ValidadesConfigCard
        config={ctx.contexto?.config}
        form={ctx.configForm}
        podeEditar={ctx.permissoes.gerenciarRegras}
        isSaving={ctx.configSaving}
        feedback={ctx.configFeedback}
        onChange={ctx.handleConfigChange}
        onSubmit={ctx.handleConfigSubmit}
      />

      <RequisitoRegrasModal
        state={ctx.regrasState}
        catalogos={ctx.catalogos}
        podeGerenciar={ctx.permissoes.gerenciarRequisitos}
        pessoaBusca={ctx.pessoaBusca}
        pessoaSugestoes={ctx.pessoaSugestoes}
        pessoaBuscando={ctx.pessoaBuscando}
        onClose={ctx.closeRegras}
        onChange={ctx.handleRegraChange}
        onSubmit={ctx.handleRegraSubmit}
        onRemover={ctx.openRemoverRegra}
        onPessoaBuscaChange={ctx.handlePessoaBuscaChange}
        onPessoaSelect={ctx.handlePessoaSelect}
      />
      <RequisitoHistoricoModal state={ctx.historicoState} onClose={ctx.closeHistorico} />
      <ValidadeMotivoModal
        state={ctx.motivoState}
        onClose={ctx.closeMotivo}
        onChange={ctx.handleMotivoChange}
        onSubmit={ctx.handleMotivoSubmit}
      />
    </>
  )
}

export function RequisitosControlePage() {
  return (
    <div className="stack">
      <PageHeader
        icon={<ChecklistIcon size={28} />}
        title="Requisitos de Controle"
        subtitle="Treinamentos, documentos, certificados e exames obrigatorios, com validade e a quem se aplicam."
        actions={<HelpButton topic="requisitosControle" />}
      />
      <RequisitosControleProvider>
        <RequisitosControleContent />
      </RequisitosControleProvider>
    </div>
  )
}
