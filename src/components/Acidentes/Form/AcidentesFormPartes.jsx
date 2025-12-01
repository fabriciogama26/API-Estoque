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

  const currentPartes = useMemo(
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
    const lista = Array.isArray(partes) ? partes : []
    lista.forEach((item) => {
      if (typeof item === 'string') {
        const nome = normalizeText(item)
        if (nome && !map.has(nome.toLowerCase())) {
          map.set(nome.toLowerCase(), { value: nome, label: nome })
        }
        return
      }
      if (item && typeof item === 'object') {
        const nome = normalizeText(item.nome ?? item.label)
        const label = normalizeText(item.label) || nome
        if (nome && !map.has(nome.toLowerCase())) {
          map.set(nome.toLowerCase(), { value: nome, label: label || nome })
        }
      }
    })
    currentPartes.forEach((parte) => {
      const nome = normalizeText(parte)
      if (nome && !map.has(nome.toLowerCase())) {
        map.set(nome.toLowerCase(), { value: nome, label: nome })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [currentPartes, partes])

  useEffect(() => {
    if (parteSelecionada && !parteSelectOptions.some((option) => option.value === parteSelecionada)) {
      setParteSelecionada('')
    }
  }, [parteSelecionada, parteSelectOptions])

  const updatePartes = (lista) => {
    onChange({ target: { name: 'partesLesionadas', value: lista } })
  }

  const removerParte = (parteParaRemover) => {
    const atualizadas = currentPartes.filter((parte) => parte !== parteParaRemover)
    updatePartes(atualizadas)
  }

  const handlePartesSelectChange = (event) => {
    setParteSelecionada(event.target.value)
  }

  const adicionarParteSelecionada = () => {
    const valor = normalizeText(parteSelecionada)
    if (!valor) {
      return
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    if (currentPartes.some((item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave)) {
      setParteSelecionada('')
      return
    }
    updatePartes([...currentPartes, valor])
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
          required={!currentPartes.length}
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
          {currentPartes.length ? (
            currentPartes.map((parte) => (
              <button
                type="button"
                key={parte}
                className="chip"
                onClick={() => removerParte(parte)}
                aria-label={`Remover ${parte}`}
              >
                {parte} <span aria-hidden="true">x</span>
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
