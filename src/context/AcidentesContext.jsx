import { createContext, useContext, useMemo } from 'react'
import { useAcidentes } from '../hooks/useAcidentes.js'
import { useAcidenteFiltro } from '../hooks/useAcidenteFiltro.js'
import { useAgentes } from '../hooks/useAgentes.js'
import {
  extractAgentes,
  extractCentrosServico,
  extractTipos,
  extractLesoes,
  extractPartesLesionadas,
} from '../rules/AcidentesRules.js'

const AcidentesContext = createContext(null)

export function AcidentesProvider({ children }) {
  const acidentesState = useAcidentes()
  const filtroState = useAcidenteFiltro(acidentesState.acidentes)
  const agentesState = useAgentes()

  const tiposFiltro = useMemo(
    () => extractTipos(acidentesState.acidentes),
    [acidentesState.acidentes],
  )
  const centrosServico = useMemo(
    () => extractCentrosServico(acidentesState.acidentes),
    [acidentesState.acidentes],
  )
  const agentesFiltro = useMemo(
    () => extractAgentes(acidentesState.acidentes),
    [acidentesState.acidentes],
  )
  const lesoesFiltro = useMemo(
    () => extractLesoes(acidentesState.acidentes),
    [acidentesState.acidentes],
  )
  const partesLesionadasFiltro = useMemo(
    () => extractPartesLesionadas(acidentesState.acidentes),
    [acidentesState.acidentes],
  )

  const value = {
    ...acidentesState,
    ...filtroState,
    tiposFiltro,
    centrosServico,
    agentesFiltro,
    lesoesFiltro,
    partesLesionadasFiltro,
    agentes: agentesState.agentes,
    agentesError: agentesState.error,
    isLoadingAgentes: agentesState.isLoading,
    reloadAgentes: agentesState.reload,
  }

  return <AcidentesContext.Provider value={value}>{children}</AcidentesContext.Provider>
}

export const useAcidentesContext = () => {
  const ctx = useContext(AcidentesContext)
  if (!ctx) {
    throw new Error('useAcidentesContext deve ser usado dentro de AcidentesProvider')
  }
  return ctx
}
