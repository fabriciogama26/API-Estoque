import { useMemo, useState } from 'react'
import { ACIDENTES_FILTER_DEFAULT } from '../config/AcidentesConfig.js'
import { filterAcidentes } from '../routes/rules/AcidentesRules.js'

export function useAcidenteFiltro(acidentes = []) {
  const [filters, setFilters] = useState(() => ({ ...ACIDENTES_FILTER_DEFAULT }))
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...ACIDENTES_FILTER_DEFAULT }))

  const handleFilterChange = (event) => {
    const { name, type } = event.target
    const value =
      type === 'checkbox' && typeof event.target.checked === 'boolean'
        ? event.target.checked
        : event.target.value
    if (name === 'centroServico') {
      setFilters((prev) => ({ ...prev, centroServico: value, setor: value }))
      return
    }
    if (type === 'checkbox') {
      setFilters((prev) => ({ ...prev, [name]: value }))
      setAppliedFilters((prev) => ({ ...prev, [name]: value }))
      return
    }
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
    setAppliedFilters({ ...filters })
  }

  const handleFilterClear = () => {
    const defaults = { ...ACIDENTES_FILTER_DEFAULT }
    setFilters(defaults)
    setAppliedFilters(defaults)
  }

  const acidentesFiltrados = useMemo(
    () => filterAcidentes(acidentes, appliedFilters),
    [acidentes, appliedFilters],
  )

  return {
    filters,
    setFilters,
    appliedFilters,
    setAppliedFilters,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    acidentesFiltrados,
  }
}
