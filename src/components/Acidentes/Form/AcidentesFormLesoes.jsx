import { useEffect, useMemo, useState } from 'react'
import { AddIcon } from '../../icons.jsx'
import { normalizeText } from '../../../utils/acidentesUtils.js'

export function AcidentesFormLesoes({
  form,
  onChange,
  lesoes = [],
  isLoadingLesoes = false,
  inline = false,
}) {
  const [novaLesao, setNovaLesao] = useState('')

  const fallbackLesoes = useMemo(
    () =>
      Array.isArray(form.lesoes) && form.lesoes.length
        ? form.lesoes
        : form.lesao
          ? [form.lesao]
          : [],
    [form.lesao, form.lesoes],
  )

  const lesaoSelectOptions = useMemo(() => {
    const map = new Map()
    const buildKey = (nome) => normalizeText(nome).toLocaleLowerCase('pt-BR')
    const lista = Array.isArray(lesoes) ? lesoes : []
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
    fallbackLesoes.forEach(addOption)
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [fallbackLesoes, lesoes])

  const lesaoOptionsById = useMemo(() => {
    const map = new Map()
    lesaoSelectOptions.forEach((option) => {
      if (option.id) {
        map.set(String(option.id), option)
      }
    })
    return map
  }, [lesaoSelectOptions])

  const currentLesoesIds = useMemo(
    () => (Array.isArray(form.lesoesIds) ? form.lesoesIds.filter(Boolean) : []),
    [form.lesoesIds],
  )

  const currentLesoesSelecionadas = useMemo(() => {
    if (currentLesoesIds.length) {
      return currentLesoesIds.map((id, index) => {
        const option = lesaoOptionsById.get(String(id))
        const fallbackNome = fallbackLesoes[index] ?? ''
        const nome = option?.nome ?? fallbackNome ?? ''
        const label = (option?.label ?? nome) || String(id)
        return {
          id: String(id),
          nome: nome || label,
          label,
        }
      })
    }
    return fallbackLesoes.map((nome) => ({ id: nome, nome, label: nome }))
  }, [currentLesoesIds, fallbackLesoes, lesaoOptionsById])

  useEffect(() => {
    if (novaLesao && !lesaoSelectOptions.some((option) => option.value === novaLesao)) {
      setNovaLesao('')
    }
  }, [novaLesao, lesaoSelectOptions])

  const updateLesoes = (lista) => {
    const nomes = lista.map((item) => item.nome).filter(Boolean)
    const ids = lista.map((item) => item.id).filter(Boolean)
    onChange({ target: { name: 'lesoes', value: nomes } })
    onChange({ target: { name: 'lesao', value: nomes[0] ?? '' } })
    onChange({ target: { name: 'lesoesIds', value: ids } })
  }

  const removerLesao = (lesaoId) => {
    const atualizadas = currentLesoesSelecionadas.filter((lesao) => String(lesao.id) !== String(lesaoId))
    updateLesoes(atualizadas)
  }

  const handleLesoesSelectChange = (event) => {
    setNovaLesao(event.target.value)
  }

  const adicionarLesaoSelecionada = () => {
    const option = lesaoSelectOptions.find((item) => item.value === novaLesao)
    if (!option) {
      return
    }
    const id = option.id ?? option.value
    if (currentLesoesSelecionadas.some((item) => String(item.id) === String(id))) {
      setNovaLesao('')
      return
    }
    updateLesoes([
      ...currentLesoesSelecionadas,
      { id: String(id), nome: option.nome, label: option.label },
    ])
    setNovaLesao('')
  }

  const podeAdicionarLesao = Boolean(normalizeText(novaLesao))
  const noLesoesDisponiveis = lesaoSelectOptions.length === 0
  const shouldDisableLesoes = (isLoadingLesoes && noLesoesDisponiveis) || noLesoesDisponiveis

  const lesoesPlaceholder = (() => {
    if (isLoadingLesoes && lesaoSelectOptions.length === 0) {
      return 'Carregando lesoes...'
    }
    if (lesaoSelectOptions.length === 0) {
      return 'Nenhuma lesao disponivel'
    }
    return 'Selecione a lesao'
  })()

  const content = (
    <label className="field">
      <span>Lesoes <span className="asterisco">*</span></span>
      <div className="multi-select">
        <select
          name="lesoes"
          value={novaLesao}
          onChange={handleLesoesSelectChange}
          required={!currentLesoesSelecionadas.length}
          disabled={shouldDisableLesoes}
        >
          <option value="">{lesoesPlaceholder}</option>
          {lesaoSelectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="multi-select__actions">
          <button
            type="button"
            className="icon-button"
            onClick={adicionarLesaoSelecionada}
            disabled={!podeAdicionarLesao || shouldDisableLesoes}
            aria-label="Adicionar lesao"
            title="Adicionar lesao"
          >
            <AddIcon size={16} />
          </button>
        </div>
        <div className="multi-select__chips">
          {currentLesoesSelecionadas.length ? (
            currentLesoesSelecionadas.map((lesao) => (
              <button
                type="button"
                key={lesao.id}
                className="chip"
                onClick={() => removerLesao(lesao.id)}
                aria-label={`Remover ${lesao.label}`}
              >
                {lesao.label} <span aria-hidden="true">x</span>
              </button>
            ))
          ) : (
            <span className="multi-select__placeholder">Nenhuma lesao adicionada</span>
          )}
        </div>
      </div>
      <input type="hidden" name="lesao" value={form.lesao} readOnly />
    </label>
  )

  if (inline) {
    return content
  }

  return <div className="form__grid form__grid--two">{content}</div>
}
