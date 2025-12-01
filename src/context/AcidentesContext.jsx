import { createContext, useContext, useMemo } from 'react'
import { useAcidentes } from '../hooks/useAcidentes.js'
import { useAcidenteFiltro } from '../hooks/useAcidenteFiltro.js'
import { useAgentes } from '../hooks/useAgentes.js'
import { extractAgentes, extractCentrosServico, extractTipos } from '../rules/AcidentesRules.js'
import { extractAgenteNome, normalizeAgenteKey, normalizeAgenteNome } from '../utils/acidentesUtils.js'

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

  const agenteOpcoesNomes = useMemo(() => {
    const mapa = new Map()
    agentesState.agentes.forEach((item) => {
      const nome = normalizeAgenteNome(extractAgenteNome(item))
      if (!nome) {
        return
      }
      const chave = normalizeAgenteKey(nome)
      if (!mapa.has(chave)) {
        mapa.set(chave, nome)
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [agentesState.agentes])

  const value = {
    ...acidentesState,
    ...filtroState,
    tiposFiltro,
    centrosServico,
    agentesFiltro,
    agentes: agentesState.agentes,
    agentesError: agentesState.error,
    isLoadingAgentes: agentesState.isLoading,
    reloadAgentes: agentesState.reload,
    agenteOpcoesNomes,
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
