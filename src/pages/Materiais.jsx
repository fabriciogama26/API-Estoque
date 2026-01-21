import { useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { MaterialIcon } from '../components/icons.jsx'
import { MateriaisForm } from '../components/Materiais/MateriaisForm.jsx'
import { MateriaisFilters } from '../components/Materiais/MateriaisFilters.jsx'
import { MateriaisTable } from '../components/Materiais/MateriaisTable.jsx'
import { MateriaisHistoryModal } from '../components/Materiais/MateriaisHistoryModal.jsx'
import { MaterialBaseDiffModal } from '../components/Materiais/Modal/MaterialBaseDiffModal.jsx'
import { MaterialDetailsModal } from '../components/Materiais/Modal/MaterialDetailsModal.jsx'
import { MateriaisProvider, useMateriaisContext } from '../context/MateriaisContext.jsx'
import { formatDisplayDateTime } from '../utils/saidasUtils.js'
import { formatCurrency } from '../utils/MateriaisUtils.js'
import { getMaterial } from '../services/materiaisService.js'
import { HelpButton } from '../components/Help/HelpButton.jsx'
import '../styles/MateriaisPage.css'

function MateriaisContent() {
  const [detalhe, setDetalhe] = useState({ open: false, material: null })
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
    loadMateriais,
    baseDiffPrompt,
    confirmBaseDiff,
    cancelBaseDiff,
  } = useMateriaisContext()

  const handleOpenDetalhe = async (material) => {
    if (!material?.id) {
      return
    }
    // Busca detalhes completos para mostrar todos os campos
    try {
      const completo = await getMaterial(material.id)
      setDetalhe({ open: true, material: completo || material })
    } catch (err) {
      setDetalhe({ open: true, material })
    }
  }

  const handleCloseDetalhe = () => setDetalhe({ open: false, material: null })

  return (
    <div className="stack">
      <PageHeader
        icon={<MaterialIcon size={28} />}
        title="Cadastro de Materiais"
        subtitle="Cadastre e edite materiais com rastreabilidade e historico de preco."
        actions={<HelpButton topic="materiais" />}
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
          <h2>Lista de Materiais</h2>
          <button type="button" className="button button--ghost" onClick={loadMateriais} disabled={isLoading}>
            Atualizar
          </button>
        </header>
        {isLoading ? <p className="feedback">Carregando...</p> : null}
        {!isLoading ? (
          <MateriaisTable
            materiais={materiaisOrdenados}
            onEdit={startEdit}
            onHistory={openHistory}
            onView={handleOpenDetalhe}
            editingId={editingMaterial?.id ?? null}
            isSaving={isSaving}
            historyModal={historyModal}
          />
        ) : null}
      </section>

      <MateriaisHistoryModal modal={historyModal} onClose={closeHistoryModal} />
      <MaterialBaseDiffModal
        open={baseDiffPrompt.open}
        details={baseDiffPrompt.details}
        onCancel={cancelBaseDiff}
        onConfirm={confirmBaseDiff}
      />
      <MaterialDetailsModal
        open={detalhe.open}
        material={detalhe.material}
        onClose={handleCloseDetalhe}
        formatCurrency={formatCurrency}
        formatDisplayDateTime={formatDisplayDateTime}
      />
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
