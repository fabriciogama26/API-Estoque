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

  const currentLesoes = useMemo(
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
    const lista = Array.isArray(lesoes) ? lesoes : []
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
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [lesoes])

  useEffect(() => {
    if (novaLesao && !lesaoSelectOptions.some((option) => option.value === novaLesao)) {
      setNovaLesao('')
    }
  }, [novaLesao, lesaoSelectOptions])

  const updateLesoes = (lista) => {
    onChange({ target: { name: 'lesoes', value: lista } })
    onChange({ target: { name: 'lesao', value: lista[0] ?? '' } })
  }

  const removerLesao = (lesaoParaRemover) => {
    const atualizadas = currentLesoes.filter((lesao) => lesao !== lesaoParaRemover)
    updateLesoes(atualizadas)
  }

  const handleLesoesSelectChange = (event) => {
    setNovaLesao(event.target.value)
  }

  const adicionarLesaoSelecionada = () => {
    const valor = normalizeText(novaLesao)
    if (!valor) {
      return
    }
    const chave = valor.toLocaleLowerCase('pt-BR')
    if (currentLesoes.some((item) => normalizeText(item).toLocaleLowerCase('pt-BR') === chave)) {
      setNovaLesao('')
      return
    }
    updateLesoes([...currentLesoes, valor])
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
          required={!currentLesoes.length}
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
          {currentLesoes.length ? (
            currentLesoes.map((lesao) => (
              <button
                type="button"
                key={lesao}
                className="chip"
                onClick={() => removerLesao(lesao)}
                aria-label={`Remover ${lesao}`}
              >
                {lesao} <span aria-hidden="true">x</span>
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
