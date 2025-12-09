import { PageHeader } from '../components/PageHeader.jsx'
import { PeopleIcon } from '../components/icons.jsx'
import { PessoasForm } from '../components/Pessoas/PessoasForm.jsx'
import { PessoasFilters } from '../components/Pessoas/PessoasFilters.jsx'
import { PessoasTable } from '../components/Pessoas/PessoasTable.jsx'
import { PessoasHistoryModal } from '../components/Pessoas/PessoasHistoryModal.jsx'
import { PessoasResumoCards } from '../components/PessoasResumoCards.jsx'
import { PessoasProvider, usePessoasContext } from '../context/PessoasContext.jsx'
import { HelpButton } from '../components/Help/HelpButton.jsx'

import '../styles/PessoasPage.css'

function PessoasContent() {
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
    loadPessoas,
  } = usePessoasContext()

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
          historyState={historyState}
        />
      </section>

      <PessoasHistoryModal state={historyState} onClose={closeHistory} />
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
