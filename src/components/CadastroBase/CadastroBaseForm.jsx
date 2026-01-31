import { useEffect, useMemo, useState } from 'react'

const isCapsRequiredKey = (event) => {
  const key = event.key || ''
  if (key.length !== 1) {
    return false
  }
  return /[a-zA-Z]/.test(key)
}

export function CadastroBaseForm({
  tableKey,
  tableOptions,
  tableConfig,
  form,
  isSaving,
  error,
  editingItem,
  onTableChange,
  onChange,
  onSubmit,
  onCancel,
  centrosCustoOptions,
  centrosServicoOptions,
  dependencyStatus,
}) {
  const [capsWarning, setCapsWarning] = useState(false)

  useEffect(() => {
    setCapsWarning(false)
  }, [tableKey])

  const handleNameChange = (event) => {
    const value = event.target.value || ''
    if (tableKey === 'cargos') {
      setCapsWarning(false)
      onChange({ target: { name: 'nome', value: value.toUpperCase() } })
      return
    }
    onChange(event)
  }

  const handleCapsKeyDown = (event) => {
    if (tableKey !== 'cargos') {
      return
    }
    if (!isCapsRequiredKey(event)) {
      return
    }
    if (typeof event.getModifierState !== 'function') {
      return
    }
    const capsOn = event.getModifierState('CapsLock')
    if (!capsOn) {
      event.preventDefault()
      setCapsWarning(true)
    } else {
      setCapsWarning(false)
    }
  }

  const handleCapsPaste = (event) => {
    if (tableKey !== 'cargos') {
      return
    }
    const text = event.clipboardData?.getData('text') ?? ''
    if (!text) {
      return
    }
    if (text !== text.toUpperCase()) {
      event.preventDefault()
      setCapsWarning(true)
      return
    }
    setCapsWarning(false)
  }

  const relationField = tableConfig?.relationField
  const relationLabel = tableConfig?.relationLabel
  const relationOptions = useMemo(() => {
    if (relationField === 'centroCustoId') {
      return centrosCustoOptions
    }
    if (relationField === 'centroServicoId') {
      return centrosServicoOptions
    }
    return []
  }, [centrosCustoOptions, centrosServicoOptions, relationField])

  return (
    <section className="card cadastro-base__form">
      <header className="card__header">
        <h2>Cadastro Base</h2>
      </header>

      <form className={`form${editingItem ? ' form--editing' : ''}`} onSubmit={onSubmit}>
        <div className="form__grid">
          <label className="field">
            <span>Tabela</span>
            <select name="table" value={tableKey} onChange={(event) => onTableChange(event.target.value)}>
              {tableOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {relationField ? (
            <label className="field">
              <span>
                {relationLabel} <span className="asterisco">*</span>
              </span>
              <select name={relationField} value={form[relationField] || ''} onChange={onChange} required>
                <option value="">Selecione</option>
                {relationOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field">
            <span>
              {tableConfig?.nameLabel || 'Nome'} <span className="asterisco">*</span>
            </span>
            <input
              name="nome"
              value={form.nome}
              onChange={handleNameChange}
              onKeyDown={handleCapsKeyDown}
              onPaste={handleCapsPaste}
              placeholder={`Digite ${tableConfig?.nameLabel?.toLowerCase?.() || 'o nome'}`}
              autoComplete="off"
              required
            />
            {tableKey === 'cargos' ? (
              <span className={`field__hint${capsWarning ? ' field__hint--error' : ''}`}>
                {capsWarning ? 'Ative o Caps Lock para digitar o cargo.' : 'Digite apenas em letras maiusculas.'}
              </span>
            ) : null}
          </label>

          <label className="field field--checkbox field--checkbox-accent">
            <input type="checkbox" name="ativo" checked={form.ativo !== false} onChange={onChange} />
            <span>Ativo</span>
          </label>
        </div>

        {!dependencyStatus.canSave ? (
          <p className="feedback feedback--warning">{dependencyStatus.message}</p>
        ) : null}

        {error ? <p className="feedback feedback--error">{error}</p> : null}

        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving || !dependencyStatus.canSave}>
            {isSaving ? 'Salvando...' : editingItem ? 'Salvar alteracoes' : 'Salvar cadastro'}
          </button>
          {editingItem ? (
            <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
              Cancelar edicao
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
