import { useMemo, useState } from 'react'
import { ACIDENTES_FILTER_DEFAULT } from '../config/AcidentesConfig.js'
import { filterAcidentes } from '../rules/AcidentesRules.js'

export function useAcidenteFiltro(acidentes = []) {
  const [filters, setFilters] = useState(() => ({ ...ACIDENTES_FILTER_DEFAULT }))

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
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleFilterSubmit = (event) => {
    event.preventDefault()
  }

  const handleFilterClear = () => {
    setFilters({ ...ACIDENTES_FILTER_DEFAULT })
  }

  const acidentesFiltrados = useMemo(
    () => filterAcidentes(acidentes, filters),
    [acidentes, filters],
  )

  return {
    filters,
    setFilters,
    handleFilterChange,
    handleFilterSubmit,
    handleFilterClear,
    acidentesFiltrados,
  }
}
