import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader.jsx'
import { MaterialIcon } from '../components/icons.jsx'
import { MateriaisForm } from '../components/Materiais/MateriaisForm.jsx'
import { MateriaisFilters } from '../components/Materiais/MateriaisFilters.jsx'
import { MateriaisTable } from '../components/Materiais/MateriaisTable.jsx'
import { MateriaisHistoryModal } from '../components/Materiais/MateriaisHistoryModal.jsx'
import { dataClient as api } from '../services/dataClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  HISTORY_MODAL_DEFAULT,
  MATERIAIS_FILTER_DEFAULT,
  MATERIAIS_FORM_DEFAULT,
} from '../config/MateriaisConfig.js'
import {
  createMaterialPayload,
  filterMateriais,
  resolveUsuarioNome,
  validateMaterialForm,
  sortMateriaisByNome,
  updateMaterialPayload,
  GRUPO_MATERIAL_CALCADO,
  GRUPO_MATERIAL_VESTIMENTA,
} from '../rules/MateriaisRules.js'
import { formatCurrency, formatCurrencyInput, sanitizeDigits } from '../utils/MateriaisUtils.js'
import '../styles/MateriaisPage.css'

const normalizeGrupo = (value) =>
  value
    ? value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : ''

const isGrupo = (value, target) => normalizeGrupo(value) === normalizeGrupo(target)

export function MateriaisPage() {
  const { user } = useAuth()
  const [form, setForm] = useState(() => ({ ...MATERIAIS_FORM_DEFAULT }))
  const [filters, setFilters] = useState(() => ({ ...MATERIAIS_FILTER_DEFAULT }))
  const [materiais, setMateriais] = useState([])
  const [historyCache, setHistoryCache] = useState({})
  const [historyModal, setHistoryModal] = useState(() => ({ ...HISTORY_MODAL_DEFAULT }))
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [materialGroups, setMaterialGroups] = useState([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)
  const [groupsError, setGroupsError] = useState(null)

  const loadMaterialGroups = useCallback(async () => {
    setIsLoadingGroups(true)
    setGroupsError(null)
    try {
      const grupos = await api.materiais.groups()
      const lista =
        Array.isArray(grupos)
          ? Array.from(
              new Set(
                grupos
                  .map((grupo) => (grupo && typeof grupo === 'string' ? grupo.trim() : ''))
                  .filter(Boolean)
              )
            ).sort((a, b) => a.localeCompare(b))
          : []
      setMaterialGroups(lista)
    } catch (err) {
      setGroupsError(err.message)
      setMaterialGroups([])
    } finally {
      setIsLoadingGroups(false)
    }
  }, [])

  const loadMateriais = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const items = await api.materiais.list()
      setMateriais(items ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMateriais()
  }, [loadMateriais])

  useEffect(() => {
    loadMaterialGroups()
  }, [loadMaterialGroups])

  const handleFormChange = (event) => {
    const { name, value } = event.target

    if (name === 'ca') {
      setForm((prev) => ({ ...prev, ca: sanitizeDigits(value) }))
      return
    }

    if (name === 'valorUnitario') {
      setForm((prev) => ({ ...prev, valorUnitario: formatCurrencyInput(value) }))
      return
    }

    if (name === 'nome') {
      const sanitized = value.replace(/\d/g, '')
      setForm((prev) => ({ ...prev, nome: sanitized }))
      return
    }

    if (name === 'grupoMaterial') {
      setForm((prev) => ({
        ...prev,
        grupoMaterial: value,
        numeroCalcado: isGrupo(value, GRUPO_MATERIAL_CALCADO) ? prev.numeroCalcado : '',
        numeroVestimenta: isGrupo(value, GRUPO_MATERIAL_VESTIMENTA) ? prev.numeroVestimenta : '',
      }))
      return
    }

    if (name === 'numeroCalcado') {
      setForm((prev) => ({ ...prev, numeroCalcado: sanitizeDigits(value) }))
      return
    }

    if (name === 'numeroVestimenta') {
      setForm((prev) => ({ ...prev, numeroVestimenta: value }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
  }

  const handleFilterClear = () => {
    setFilters({ ...MATERIAIS_FILTER_DEFAULT })
  }

  const resetForm = () => {
    setEditingMaterial(null)
    setForm({ ...MATERIAIS_FORM_DEFAULT })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    const validationError = validateMaterialForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)

    try {
      const usuario = resolveUsuarioNome(user)

      if (editingMaterial) {
        await api.materiais.update(editingMaterial.id, updateMaterialPayload(form, usuario))
      } else {
        await api.materiais.create(createMaterialPayload(form, usuario))
      }

      resetForm()
      setHistoryCache({})
      setHistoryModal({ ...HISTORY_MODAL_DEFAULT })
      await loadMateriais()
      await loadMaterialGroups()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const openHistory = async (material) => {
    setError(null)

    const cached = historyCache[material.id]
    if (cached) {
      setHistoryModal({ ...HISTORY_MODAL_DEFAULT, open: true, material, items: cached })
      return
    }

    setHistoryModal({ ...HISTORY_MODAL_DEFAULT, open: true, material, isLoading: true })
    try {
      const data = await api.materiais.priceHistory(material.id)
      const items = data ?? []
      setHistoryCache((prev) => ({ ...prev, [material.id]: items }))
      setHistoryModal({ ...HISTORY_MODAL_DEFAULT, open: true, material, items })
    } catch (err) {
      setError(err.message)
      setHistoryModal({
        ...HISTORY_MODAL_DEFAULT,
        open: true,
        material,
        error: err.message || 'Nao foi possivel carregar o historico.',
      })
    }
  }

  const closeHistoryModal = () => {
    setHistoryModal({ ...HISTORY_MODAL_DEFAULT })
  }

  const startEdit = (material) => {
    setEditingMaterial(material)
    setMaterialGroups((prev) => {
      if (!material.grupoMaterial) {
        return prev
      }
      if (prev.includes(material.grupoMaterial)) {
        return prev
      }
      return [...prev, material.grupoMaterial].sort((a, b) => a.localeCompare(b))
    })
    setForm({
      nome: material.nome || '',
      fabricante: material.fabricante || '',
      validadeDias: String(material.validadeDias ?? ''),
      ca: material.ca || '',
      valorUnitario: formatCurrency(material.valorUnitario),
      grupoMaterial: material.grupoMaterial || '',
      numeroCalcado: material.numeroCalcado || '',
      numeroVestimenta: material.numeroVestimenta || '',
    })
  }

  const cancelEdit = () => {
    resetForm()
  }

  const materiaisFiltrados = useMemo(
    () => filterMateriais(materiais, filters),
    [materiais, filters],
  )

  const materiaisOrdenados = useMemo(
    () => sortMateriaisByNome(materiaisFiltrados),
    [materiaisFiltrados],
  )

  return (
    <div className="stack">
      <PageHeader
        icon={<MaterialIcon size={28} />}
        title="Materiais"
        subtitle="Cadastre EPIs com validade, CA e mantenha historico de precos."
      />

      <MateriaisForm
        form={form}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        editingMaterial={editingMaterial}
        onCancel={cancelEdit}
        error={error}
        materialGroups={materialGroups}
        isLoadingGroups={isLoadingGroups}
        groupsError={groupsError}
      />

      <MateriaisFilters
        filters={filters}
        onChange={handleFilterChange}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
      />

      <section className="card">
        <header className="card__header">
          <h2>Materiais cadastrados</h2>
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
