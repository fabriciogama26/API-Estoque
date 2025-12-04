import { useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { MaterialIcon } from '../components/icons.jsx'
import { MateriaisForm } from '../components/Materiais/MateriaisForm.jsx'
import { MateriaisFilters } from '../components/Materiais/MateriaisFilters.jsx'
import { MateriaisTable } from '../components/Materiais/MateriaisTable.jsx'
import { MateriaisHistoryModal } from '../components/Materiais/MateriaisHistoryModal.jsx'
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
        title="Cadastro de EPI's"
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
          <h2>Materiais cadastrados</h2>
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
      {detalhe.open && detalhe.material ? (
        <div className="saida-details__overlay" role="dialog" aria-modal="true" onClick={handleCloseDetalhe}>
          <div className="saida-details__modal" onClick={(event) => event.stopPropagation()}>
            <header className="saida-details__header">
              <div>
                <p className="saida-details__eyebrow">ID do material</p>
                <h3 className="saida-details__title">{detalhe.material.id || 'ID não informado'}</h3>
              </div>
              <button
                type="button"
                className="saida-details__close"
                onClick={handleCloseDetalhe}
                aria-label="Fechar detalhes"
              >
                x
              </button>
            </header>

            <div className="saida-details__section">
              <h4 className="saida-details__section-title">Dados principais</h4>
              <div className="saida-details__grid">
                <div className="saida-details__item">
                  <span className="saida-details__label">Material</span>
                  <p className="saida-details__value">
                    {detalhe.material.nomeItemRelacionado || detalhe.material.nome || '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Grupo</span>
                  <p className="saida-details__value">
                    {detalhe.material.grupoMaterialNome || detalhe.material.grupoMaterial || '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Tamanho</span>
                  <p className="saida-details__value">
                    {detalhe.material.numeroCalcadoNome ||
                      detalhe.material.numeroVestimentaNome ||
                      detalhe.material.numeroCalcado ||
                      detalhe.material.numeroVestimenta ||
                      '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">CA</span>
                  <p className="saida-details__value">{detalhe.material.ca || '-'}</p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Validade (dias)</span>
                  <p className="saida-details__value">
                    {(detalhe.material.validadeDias ?? detalhe.material.validade) || '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Valor unitário</span>
                  <p className="saida-details__value">
                    {detalhe.material.valorUnitario ? formatCurrency(detalhe.material.valorUnitario) : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="saida-details__section">
              <h4 className="saida-details__section-title">Características</h4>
              <div className="saida-details__grid">
                <div className="saida-details__item">
                  <span className="saida-details__label">Cores</span>
                  <p className="saida-details__value">
                    {detalhe.material.coresTexto ||
                      (Array.isArray(detalhe.material.coresNomes) && detalhe.material.coresNomes.length
                        ? detalhe.material.coresNomes.join(', ')
                        : detalhe.material.corMaterial || '-')}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Características</span>
                  <p className="saida-details__value">
                    {detalhe.material.caracteristicasTexto ||
                      (Array.isArray(detalhe.material.caracteristicasNomes) && detalhe.material.caracteristicasNomes.length
                        ? detalhe.material.caracteristicasNomes.join(', ')
                        : detalhe.material.caracteristicaEpi || '-')}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Fabricante</span>
                  <p className="saida-details__value">
                    {detalhe.material.fabricanteNome || detalhe.material.fabricante || '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="saida-details__section">
              <h4 className="saida-details__section-title">Registro</h4>
              <div className="saida-details__grid">
                <div className="saida-details__item">
                  <span className="saida-details__label">Registrado por</span>
                  <p className="saida-details__value">
                    {detalhe.material.usuarioCadastroUsername ||
                      detalhe.material.registradoPor ||
                      detalhe.material.usuarioCadastroNome ||
                      detalhe.material.usuarioCadastro ||
                      '-'}
                  </p>
                </div>
                <div className="saida-details__item">
                  <span className="saida-details__label">Cadastrado em</span>
                  <p className="saida-details__value">
                    {detalhe.material.criadoEm || detalhe.material.created_at || detalhe.material.createdAt
                      ? formatDisplayDateTime(detalhe.material.criadoEm || detalhe.material.created_at || detalhe.material.createdAt)
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            <footer className="saida-details__footer">
              <button type="button" className="button button--ghost" onClick={handleCloseDetalhe}>
                Fechar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
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
