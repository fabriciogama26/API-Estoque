import { useEffect, useMemo, useState } from 'react'
import { AddIcon } from '../../icons.jsx'
import { normalizeText } from '../../../utils/acidentesUtils.js'

export function AcidentesFormPartes({
  form,
  onChange,
  partes = [],
  isLoadingPartes = false,
  inline = false,
}) {
  const [parteSelecionada, setParteSelecionada] = useState('')

  const fallbackPartes = useMemo(
    () =>
      Array.isArray(form.partesLesionadas)
        ? form.partesLesionadas
        : form.parteLesionada
          ? [form.parteLesionada]
          : [],
    [form.parteLesionada, form.partesLesionadas],
  )

  const parteSelectOptions = useMemo(() => {
    const map = new Map()
    const buildKey = (nome) => normalizeText(nome).toLocaleLowerCase('pt-BR')
    const lista = Array.isArray(partes) ? partes : []
    const addOption = (item) => {
      if (!item) {
        return
      }
      if (typeof item === 'string') {
        const nome = normalizeText(item)
        if (!nome) {
          return
        }
        const chave = buildKey(nome)
        const existente = map.get(chave)
        if (!existente) {
          map.set(chave, { id: null, nome, label: nome, value: nome })
        }
        return
      }
      if (item && typeof item === 'object') {
        const nome = normalizeText(item.nome ?? item.label ?? item.value)
        if (!nome) {
          return
        }
        const label = normalizeText(item.label) || nome
        const id = item.id ?? null
        const chave = buildKey(nome)
        const existente = map.get(chave)
        if (!existente || (!existente.id && id)) {
          map.set(chave, { id, nome, label, value: String(id ?? nome) })
        }
      }
    }
    lista.forEach(addOption)
    fallbackPartes.forEach(addOption)
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [fallbackPartes, partes])

  const parteOptionsById = useMemo(() => {
    const map = new Map()
    parteSelectOptions.forEach((option) => {
      if (option.id) {
        map.set(String(option.id), option)
      }
    })
    return map
  }, [parteSelectOptions])

  const currentPartesIds = useMemo(
    () => (Array.isArray(form.partesIds) ? form.partesIds.filter(Boolean) : []),
    [form.partesIds],
  )

  const currentPartesSelecionadas = useMemo(() => {
    if (currentPartesIds.length) {
      return currentPartesIds.map((id, index) => {
        const option = parteOptionsById.get(String(id))
        const fallbackNome = fallbackPartes[index] ?? ''
        const nome = option?.nome ?? fallbackNome ?? ''
        const label = (option?.label ?? nome) || String(id)
        return {
          id: String(id),
          nome: nome || label,
          label,
        }
      })
    }
    return fallbackPartes.map((nome) => ({ id: nome, nome, label: nome }))
  }, [currentPartesIds, fallbackPartes, parteOptionsById])

  useEffect(() => {
    if (parteSelecionada && !parteSelectOptions.some((option) => option.value === parteSelecionada)) {
      setParteSelecionada('')
    }
  }, [parteSelecionada, parteSelectOptions])

  const updatePartes = (lista) => {
    const nomes = lista.map((item) => item.nome).filter(Boolean)
    const ids = lista.map((item) => item.id).filter(Boolean)
    onChange({ target: { name: 'partesLesionadas', value: nomes } })
    onChange({ target: { name: 'partesIds', value: ids } })
  }

  const removerParte = (parteId) => {
    const atualizadas = currentPartesSelecionadas.filter((parte) => String(parte.id) !== String(parteId))
    updatePartes(atualizadas)
  }

  const handlePartesSelectChange = (event) => {
    setParteSelecionada(event.target.value)
  }

  const adicionarParteSelecionada = () => {
    const option = parteSelectOptions.find((item) => item.value === parteSelecionada)
    if (!option) {
      return
    }
    const id = option.id ?? option.value
    if (currentPartesSelecionadas.some((item) => String(item.id) === String(id))) {
      setParteSelecionada('')
      return
    }
    updatePartes([
      ...currentPartesSelecionadas,
      { id: String(id), nome: option.nome, label: option.label },
    ])
    setParteSelecionada('')
  }

  const podeAdicionarParte = Boolean(normalizeText(parteSelecionada))
  const noPartesDisponiveis = parteSelectOptions.length === 0
  const shouldDisablePartes = (isLoadingPartes && noPartesDisponiveis) || noPartesDisponiveis

  const partesPlaceholder = (() => {
    if (isLoadingPartes && parteSelectOptions.length === 0) {
      return 'Carregando partes...'
    }
    if (parteSelectOptions.length === 0) {
      return 'Nenhuma parte disponivel'
    }
    return 'Selecione a parte lesionada'
  })()

  const content = (
    <label className="field">
      <span>Partes lesionadas <span className="asterisco">*</span></span>
      <div className="multi-select">
        <select
          name="partesLesionadas"
          value={parteSelecionada}
          onChange={handlePartesSelectChange}
          required={!currentPartesSelecionadas.length}
          disabled={shouldDisablePartes}
        >
          <option value="">{partesPlaceholder}</option>
          {parteSelectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="multi-select__actions">
          <button
            type="button"
            className="icon-button"
            onClick={adicionarParteSelecionada}
            disabled={!podeAdicionarParte || shouldDisablePartes}
            aria-label="Adicionar parte lesionada"
            title="Adicionar parte lesionada"
          >
            <AddIcon size={16} />
          </button>
        </div>
        <div className="multi-select__chips">
          {currentPartesSelecionadas.length ? (
            currentPartesSelecionadas.map((parte) => (
              <button
                type="button"
                key={parte.id}
                className="chip"
                onClick={() => removerParte(parte.id)}
                aria-label={`Remover ${parte.label}`}
              >
                {parte.label} <span aria-hidden="true">x</span>
              </button>
            ))
          ) : (
            <span className="multi-select__placeholder">Nenhuma parte adicionada</span>
          )}
        </div>
      </div>
    </label>
  )

  if (inline) {
    return content
  }

  return <div className="form__grid form__grid--two">{content}</div>
}
