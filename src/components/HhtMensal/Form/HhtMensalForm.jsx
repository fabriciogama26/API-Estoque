import { useMemo } from 'react'
import { computeHhtCalculado, computeHhtFinal, formatHhtValue, normalizeModo } from '../../../utils/hhtMensalUtils.js'

export function HhtMensalForm({
  form,
  centrosServico = [],
  onChange,
  onSubmit,
  onCancel,
  isSaving = false,
  isEditing = false,
  error = null,
  savedHhtCalculado = null,
  savedHhtFinal = null,
}) {
  const modo = normalizeModo(form?.modo)
  const isManual = modo === 'manual'
  const isSimples = modo === 'simples'

  const hhtCalculado = useMemo(() => computeHhtCalculado(form || {}), [form])
  const hhtFinal = useMemo(() => computeHhtFinal(form || {}), [form])
  const hhtPreview = hhtFinal ?? hhtCalculado
  const savedPreview = savedHhtFinal ?? savedHhtCalculado ?? null

  const handleInputChange = (field) => (event) => {
    onChange?.(field, event.target.value)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.()
  }

  const centrosOptions = useMemo(() => {
    return (Array.isArray(centrosServico) ? centrosServico : [])
      .filter((item) => item && (item.id || item.nome || item.label))
      .map((item) => ({
        id: item.id ?? item.value ?? item.uuid ?? item.codigo ?? String(item.nome || item.label || item.id || ''),
        nome: item.nome ?? item.label ?? item.descricao ?? item.value ?? '',
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [centrosServico])

  return (
    <section className="card">
      <header className="card__header">
        <div>
          <h2>Cadastro de HHT mensal</h2>
          <p className="card__subtitle">
            Defina o mes de referencia, centro de servico e os valores usados no calculo do HHT.
          </p>
        </div>
        {isEditing ? <span className="tag">Editando</span> : null}
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__grid form__grid--three">
          <label className="field">
            <span>
              Mes de referencia <span className="asterisco">*</span>
            </span>
            <input
              type="month"
              name="mesRefMonth"
              value={form.mesRefMonth ?? ''}
              onChange={handleInputChange('mesRefMonth')}
              required
              disabled={isSaving}
            />
            <small className="field__hint">Usa sempre o primeiro dia do mes para salvar.</small>
          </label>

          <label className="field">
            <span>
              Centro de servico <span className="asterisco">*</span>
            </span>
            <select
              name="centroServicoId"
              value={form.centroServicoId ?? ''}
              onChange={handleInputChange('centroServicoId')}
              required
              disabled={isSaving}
            >
              <option value="">{centrosOptions.length ? 'Selecione o centro' : 'Carregando centros...'}</option>
              {centrosOptions.map((centro) => (
                <option key={centro.id} value={centro.id}>
                  {centro.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>
              Modo <span className="asterisco">*</span>
            </span>
            <select name="modo" value={modo} onChange={handleInputChange('modo')} required disabled={isSaving}>
              <option value="simples">Simples</option>
              <option value="completo">Completo</option>
              <option value="manual">Manual</option>
            </select>
            <small className="field__hint">
              Simples usa pessoas x horas base. Completo considera descontos/extras. Manual usa o HHT informado.
            </small>
          </label>
        </div>

        <div className="form__grid form__grid--three">
          <label className="field">
            <span>
              Quantidade de pessoas <span className="asterisco">*</span>
            </span>
            <input
              type="number"
              min="0"
              step="1"
              name="qtdPessoas"
              value={form.qtdPessoas ?? ''}
              onChange={handleInputChange('qtdPessoas')}
              required
              disabled={isSaving}
            />
          </label>

          <label className="field">
            <span>
              Horas do mes base <span className="asterisco">*</span>
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="horasMesBase"
              value={form.horasMesBase ?? ''}
              onChange={handleInputChange('horasMesBase')}
              required
              disabled={isSaving}
            />
          </label>

          <label className="field">
            <span>Escala</span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="escalaFactor"
              value={form.escalaFactor ?? ''}
              onChange={handleInputChange('escalaFactor')}
              disabled={isSaving || isSimples}
            />
            <small className="field__hint">No modo simples a escala fica fixa em 1.</small>
          </label>

          <label className="field">
            <span>Horas afastamento</span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="horasAfastamento"
              value={form.horasAfastamento ?? ''}
              onChange={handleInputChange('horasAfastamento')}
              disabled={isSaving || isSimples}
            />
          </label>

          <label className="field">
            <span>Horas ferias</span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="horasFerias"
              value={form.horasFerias ?? ''}
              onChange={handleInputChange('horasFerias')}
              disabled={isSaving || isSimples}
            />
          </label>

          <label className="field">
            <span>Horas treinamento</span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="horasTreinamento"
              value={form.horasTreinamento ?? ''}
              onChange={handleInputChange('horasTreinamento')}
              disabled={isSaving || isSimples}
            />
          </label>

          <label className="field">
            <span>Horas outros descontos</span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="horasOutrosDescontos"
              value={form.horasOutrosDescontos ?? ''}
              onChange={handleInputChange('horasOutrosDescontos')}
              disabled={isSaving || isSimples}
            />
          </label>

          <label className="field">
            <span>Horas extras</span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="horasExtras"
              value={form.horasExtras ?? ''}
              onChange={handleInputChange('horasExtras')}
              disabled={isSaving || isSimples}
            />
          </label>

          <label className="field">
            <span>
              HHT informado {isManual ? <span className="asterisco">*</span> : null}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="hhtInformado"
              value={form.hhtInformado ?? ''}
              onChange={handleInputChange('hhtInformado')}
              required={isManual}
              disabled={isSaving || !isManual}
            />
            <small className="field__hint">Usado apenas no modo manual.</small>
          </label>
        </div>

        <div className="card card--subtle">
          <div className="form__grid form__grid--three">
            <div className="field">
            <span>HHT calculado (pre-visualizacao)</span>
              <p className="field__value">{formatHhtValue(hhtCalculado)}</p>
            </div>
            <div className="field">
              <span>HHT final</span>
              <p className="field__value">{formatHhtValue(hhtPreview)}</p>
            </div>
            {isEditing && savedPreview !== null ? (
              <div className="field">
                <span>Valor salvo</span>
                <p className="field__value">{formatHhtValue(savedPreview)}</p>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="feedback feedback--error">{error}</p> : null}

        <div className="form__actions">
          <button type="submit" className="button button--primary" disabled={isSaving}>
            {isSaving ? 'Salvando...' : isEditing ? 'Salvar alteracoes' : 'Salvar HHT'}
          </button>
          {isEditing ? (
            <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
              Cancelar edicao
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
