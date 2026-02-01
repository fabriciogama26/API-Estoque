import { useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { ChecklistIcon } from '../components/icons.jsx'
import { CadastroBaseProvider, useCadastroBaseContext } from '../context/CadastroBaseContext.jsx'
import { CadastroBaseForm } from '../components/CadastroBase/CadastroBaseForm.jsx'
import { CadastroBaseFilters } from '../components/CadastroBase/CadastroBaseFilters.jsx'
import { CadastroBaseTable } from '../components/CadastroBase/CadastroBaseTable.jsx'
import { CadastroBaseHistoryModal } from '../components/CadastroBase/CadastroBaseHistoryModal.jsx'
import { CadastroBaseImportModal } from '../components/CadastroBase/CadastroBaseImportModal.jsx'
import { downloadBasicRegistrationTemplate, importBasicRegistrationPlanilha } from '../services/basicRegistrationService.js'
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
    reloadDependencies,
  } = useCadastroBaseContext()

  const [importOpen, setImportOpen] = useState(false)
  const [importInfo, setImportInfo] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importTableKey, setImportTableKey] = useState(tableKey)

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
        onOpenImportMassa={() => {
          setImportTableKey(tableKey)
          setImportOpen(true)
        }}
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
      <CadastroBaseImportModal
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          setImportInfo(null)
          setImportLoading(false)
        }}
        tableKey={importTableKey}
        tableOptions={tableOptions}
        onTableChange={setImportTableKey}
        info={importInfo}
        disabled={importLoading}
        loading={importLoading}
        onDownloadTemplate={async () => {
          setImportInfo({ status: 'info', message: 'Baixando modelo...' })
          try {
            const { blob, filename } = await downloadBasicRegistrationTemplate(importTableKey)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename || 'cadastro_base_template.xlsx'
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
            setImportInfo({ status: 'success', message: 'Modelo baixado com sucesso.' })
          } catch (err) {
            setImportInfo({ status: 'error', message: err.message || 'Falha ao baixar modelo.' })
          }
        }}
        onUploadFile={async (file) => {
          if (!file) return
          setImportLoading(true)
          setImportInfo({ status: 'info', message: 'Enviando planilha...' })
          try {
            const result = await importBasicRegistrationPlanilha(importTableKey, file)
            setImportInfo({
              status: 'success',
              message: 'Importacao concluida.',
              stats: {
                processed: result?.processed ?? result?.total ?? 0,
                success: result?.success ?? result?.imported ?? 0,
                errors: result?.errors ?? result?.failed ?? 0,
              },
              errorsUrl: result?.errorsUrl ?? null,
              firstError: result?.firstError ?? null,
              errorSamples: result?.errorSamples ?? [],
            })
            await reloadDependencies()
            if (importTableKey === tableKey) {
              await reloadList()
            }
          } catch (err) {
            setImportInfo({
              status: 'error',
              message: err.message || 'Falha ao importar planilha.',
            })
          } finally {
            setImportLoading(false)
          }
        }}
      />
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
