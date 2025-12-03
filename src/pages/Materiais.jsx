import { PageHeader } from '../components/PageHeader.jsx'
import { MaterialIcon } from '../components/icons.jsx'
import { MateriaisForm } from '../components/Materiais/MateriaisForm.jsx'
import { MateriaisFilters } from '../components/Materiais/MateriaisFilters.jsx'
import { MateriaisTable } from '../components/Materiais/MateriaisTable.jsx'
import { MateriaisHistoryModal } from '../components/Materiais/MateriaisHistoryModal.jsx'
import { MateriaisProvider, useMateriaisContext } from '../context/MateriaisContext.jsx'
import '../styles/MateriaisPage.css'

function MateriaisContent() {
  const {
    form,
    filters,
    materiaisOrdenados,
    historyModal,
    isLoading,
    isSaving,
    error,
    editingMaterial,
    materialGroups,
    isLoadingGroups,
    groupsError,
    materialItems,
    isLoadingItems,
    itemsError,
    fabricanteOptions,
    isLoadingFabricantes,
    fabricanteError,
    caracteristicaOptions,
    isLoadingCaracteristicas,
    caracteristicaError,
    corOptions,
    isLoadingCores,
    corError,
    calcadoOptions,
    isLoadingCalcados,
    calcadoError,
    tamanhoOptions,
    isLoadingTamanhos,
    tamanhoError,
    handleFormChange,
    handleAddCaracteristica,
    handleRemoveCaracteristica,
    handleAddCor,
    handleRemoveCor,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    handleSubmit,
    openHistory,
    closeHistoryModal,
    startEdit,
    resetForm,
  } = useMateriaisContext()

  return (
    <div className="stack">
      <PageHeader
        icon={<MaterialIcon size={28} />}
        title="Cadastro de EPI's"
        subtitle="Cadastre e edite materiais com rastreabilidade e historico de preco."
      />

      <MateriaisForm
        form={form}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        editingMaterial={editingMaterial}
        onCancel={resetForm}
        error={error}
        materialGroups={materialGroups}
        isLoadingGroups={isLoadingGroups}
        groupsError={groupsError}
        materialItems={materialItems}
        isLoadingItems={isLoadingItems}
        itemsError={itemsError}
        fabricanteOptions={fabricanteOptions}
        isLoadingFabricantes={isLoadingFabricantes}
        fabricanteError={fabricanteError}
        caracteristicaOptions={caracteristicaOptions}
        isLoadingCaracteristicas={isLoadingCaracteristicas}
        caracteristicaError={caracteristicaError}
        corOptions={corOptions}
        isLoadingCores={isLoadingCores}
        corError={corError}
        calcadoOptions={calcadoOptions}
        isLoadingCalcado={isLoadingCalcados}
        calcadoError={calcadoError}
        tamanhoOptions={tamanhoOptions}
        isLoadingTamanho={isLoadingTamanhos}
        tamanhoError={tamanhoError}
        onAddCaracteristica={handleAddCaracteristica}
        onRemoveCaracteristica={handleRemoveCaracteristica}
        onAddCor={handleAddCor}
        onRemoveCor={handleRemoveCor}
      />

      <MateriaisFilters
        filters={filters}
        grupos={materialGroups}
        tamanhos={[...calcadoOptions, ...tamanhoOptions]}
        fabricantes={fabricanteOptions}
        caracteristicas={caracteristicaOptions}
        cores={corOptions}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
      />

      <section className="card">
        <header className="card__header">
          <h2>Materiais cadastrados</h2>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading ? (
          <MateriaisTable
            materiais={materiaisOrdenados}
            onEdit={startEdit}
            onHistory={openHistory}
            editingId={editingMaterial?.id ?? null}
            isSaving={isSaving}
            historyModal={historyModal}
          />
        ) : null}
      </section>

      <MateriaisHistoryModal modal={historyModal} onClose={closeHistoryModal} />
    </div>
  )
}

export function MateriaisPage() {
  return (
    <MateriaisProvider>
      <MateriaisContent />
    </MateriaisProvider>
  )
}
