import { PageHeader } from '../components/PageHeader.jsx'
import { ChecklistIcon } from '../components/icons.jsx'
import { CadastroBaseProvider, useCadastroBaseContext } from '../context/CadastroBaseContext.jsx'
import { CadastroBaseForm } from '../components/CadastroBase/CadastroBaseForm.jsx'
import { CadastroBaseFilters } from '../components/CadastroBase/CadastroBaseFilters.jsx'
import { CadastroBaseTable } from '../components/CadastroBase/CadastroBaseTable.jsx'
import { CadastroBaseHistoryModal } from '../components/CadastroBase/CadastroBaseHistoryModal.jsx'
import '../styles/CadastroBasePage.css'

function CadastroBaseContent() {
  const {
    tableKey,
    tableConfig,
    tableOptions,
    form,
    filters,
    items,
    isLoading,
    isSaving,
    error,
    editingItem,
    centrosCustoOptions,
    centrosServicoOptions,
    centrosCustoMap,
    centrosServicoMap,
    dependencyStatus,
    historyModal,
    setTableKey,
    handleFormChange,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    handleSubmit,
    startEdit,
    resetForm,
    handleInactivate,
    openHistory,
    closeHistory,
    reloadList,
  } = useCadastroBaseContext()

  return (
    <div className="stack">
      <PageHeader
        icon={<ChecklistIcon size={28} />}
        title="Cadastro Base"
        subtitle="Cadastre e edite tabelas de apoio com historico unificado."
      />

      <CadastroBaseForm
        tableKey={tableKey}
        tableOptions={tableOptions}
        tableConfig={tableConfig}
        form={form}
        isSaving={isSaving}
        error={error}
        editingItem={editingItem}
        onTableChange={setTableKey}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onCancel={resetForm}
        centrosCustoOptions={centrosCustoOptions}
        centrosServicoOptions={centrosServicoOptions}
        dependencyStatus={dependencyStatus}
      />

      <CadastroBaseFilters
        filters={filters}
        tableKey={tableKey}
        tableOptions={tableOptions}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
      />

      <CadastroBaseTable
        tableKey={tableKey}
        items={items}
        isLoading={isLoading}
        isSaving={isSaving}
        onRefresh={reloadList}
        onEdit={startEdit}
        onInactivate={handleInactivate}
        onHistory={openHistory}
        centrosCustoMap={centrosCustoMap}
        centrosServicoMap={centrosServicoMap}
      />

      <CadastroBaseHistoryModal state={historyModal} onClose={closeHistory} />
    </div>
  )
}

export function CadastroBasePage() {
  return (
    <CadastroBaseProvider>
      <CadastroBaseContent />
    </CadastroBaseProvider>
  )
}
