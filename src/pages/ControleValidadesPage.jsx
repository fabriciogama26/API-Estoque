import { PageHeader } from '../components/PageHeader.jsx'
import { BarsIcon, ChecklistIcon, RefreshIcon, SpreadsheetIcon } from '../components/icons.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import { ControleValidadesProvider, useControleValidadesContext } from '../context/ControleValidadesContext.jsx'
import { ValidadeRegistroForm } from '../components/Validades/ValidadeRegistroForm.jsx'
import { ValidadesFilters } from '../components/Validades/ValidadesFilters.jsx'
import { ValidadesPainel } from '../components/Validades/ValidadesPainel.jsx'
import { ValidadesTable } from '../components/Validades/ValidadesTable.jsx'
import { ValidadeAcaoModal } from '../components/Validades/ValidadeAcaoModal.jsx'
import { ValidadeDispensaModal } from '../components/Validades/ValidadeDispensaModal.jsx'
import { ValidadeHistoricoModal } from '../components/Validades/ValidadeHistoricoModal.jsx'
import { ValidadeMotivoModal } from '../components/Validades/ValidadeMotivoModal.jsx'
import { ValidadesIndisponivel } from '../components/Validades/ValidadesIndisponivel.jsx'
import { formatNumber } from '../utils/validadesUtils.js'
import '../styles/MateriaisPage.css'
import '../styles/DashboardPage.css'
import '../styles/ValidadesPage.css'

const TABS = [
  { id: 'painel', label: 'Painel', description: 'Cards e graficos', icon: BarsIcon },
  { id: 'lista', label: 'Lista', description: 'Colaboradores x requisitos', icon: ChecklistIcon },
]

function ControleValidadesContent() {
  const ctx = useControleValidadesContext()

  if (!ctx.disponivel) {
    return <ValidadesIndisponivel />
  }

  return (
    <>
      {ctx.permissoes.registrar ? (
        <ValidadeRegistroForm
          registro={ctx.registro}
          requisitos={ctx.requisitosAtivos}
          previa={ctx.registroPrevia}
          isSaving={ctx.registroSaving}
          feedback={ctx.registroFeedback}
          conflito={ctx.registroConflito}
          podeRenovar={ctx.permissoes.renovar}
          pessoaBusca={ctx.pessoaBusca}
          pessoaSugestoes={ctx.pessoaSugestoes}
          pessoaBuscando={ctx.pessoaBuscando}
          pessoaDropdownOpen={ctx.pessoaDropdownOpen}
          onChange={ctx.handleRegistroChange}
          onPessoaInputChange={ctx.handlePessoaInputChange}
          onPessoaSelect={ctx.handlePessoaSelect}
          onPessoaFocus={ctx.handlePessoaFocus}
          onPessoaBlur={ctx.handlePessoaBlur}
          onSubmit={ctx.handleRegistroSubmit}
          onCancel={ctx.resetRegistro}
          onRenovarConflito={ctx.renovarDoConflito}
        />
      ) : null}

      <ValidadesFilters
        filters={ctx.filters}
        requisitos={ctx.requisitos}
        catalogos={ctx.catalogos}
        onChange={ctx.handleFilterChange}
        onSubmit={ctx.handleFilterSubmit}
        onClear={ctx.handleFilterClear}
      />

      {ctx.error ? <p className="feedback feedback--error">{ctx.error}</p> : null}

      <div className="analysis-forecast-tabs" role="tablist" aria-label="Visoes do controle de validades">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const ativo = ctx.tab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              className={`analysis-forecast-tab${ativo ? ' analysis-forecast-tab--active' : ''}`}
              onClick={() => ctx.setTab(tab.id)}
            >
              <span className="analysis-forecast-tab__icon">
                <Icon size={16} />
              </span>
              <span>
                <strong>{tab.label}</strong>
                <small>{tab.id === 'lista' ? `${formatNumber(ctx.lista.total)} registro(s)` : tab.description}</small>
              </span>
            </button>
          )
        })}
      </div>

      {ctx.tab === 'painel' ? (
        <div role="tabpanel">
          <ValidadesPainel resumo={ctx.resumo} isLoading={ctx.resumoLoading} onDrill={ctx.aplicarDrill} />
        </div>
      ) : (
        <section className="card" role="tabpanel">
          <header className="card__header">
            <h2>Controle de validades</h2>
            <div className="validades-header-actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={ctx.handleExport}
                disabled={ctx.exporting || !ctx.lista.total}
                aria-label="Exportar lista filtrada em CSV"
              >
                <SpreadsheetIcon size={16} />
                <span>{ctx.exporting ? 'Exportando...' : 'Exportar Excel (CSV)'}</span>
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={ctx.refresh}
                disabled={ctx.listaLoading}
                aria-label="Atualizar lista"
              >
                <RefreshIcon size={16} />
                <span>{ctx.listaLoading ? 'Atualizando...' : 'Atualizar'}</span>
              </button>
            </div>
          </header>

          {ctx.listaLoading ? <p className="feedback">Carregando...</p> : null}

          {!ctx.listaLoading ? (
            <ValidadesTable
              itens={ctx.lista.itens}
              total={ctx.lista.total}
              page={ctx.page}
              onPageChange={ctx.setPage}
              permissoes={ctx.permissoes}
              onRegistrar={ctx.prepararRegistro}
              onRenovar={(item) => ctx.openAcao('renovar', item)}
              onEditar={(item) => ctx.openAcao('editar', item)}
              onCancelar={ctx.openCancelar}
              onDispensar={ctx.openDispensa}
              onRevogarDispensa={ctx.openRevogarDispensa}
              onHistorico={ctx.openHistorico}
            />
          ) : null}
        </section>
      )}

      <ValidadeAcaoModal
        state={ctx.acaoState}
        onClose={ctx.closeAcao}
        onChange={ctx.handleAcaoChange}
        onSubmit={ctx.handleAcaoSubmit}
      />
      <ValidadeDispensaModal
        state={ctx.dispensaState}
        onClose={ctx.closeDispensa}
        onChange={ctx.handleDispensaChange}
        onSubmit={ctx.handleDispensaSubmit}
      />
      <ValidadeMotivoModal
        state={ctx.motivoState}
        onClose={ctx.closeMotivo}
        onChange={ctx.handleMotivoChange}
        onSubmit={ctx.handleMotivoSubmit}
      />
      <ValidadeHistoricoModal state={ctx.historicoState} onClose={ctx.closeHistorico} />
    </>
  )
}

export function ControleValidadesPage() {
  return (
    <div className="stack">
      <PageHeader
        icon={<ChecklistIcon size={28} />}
        title="Controle de Validades"
        subtitle="O que cada colaborador deveria ter, o que efetivamente tem e o que esta vencendo."
        actions={<HelpButton topic="controleValidades" />}
      />
      <ControleValidadesProvider>
        <ControleValidadesContent />
      </ControleValidadesProvider>
    </div>
  )
}
