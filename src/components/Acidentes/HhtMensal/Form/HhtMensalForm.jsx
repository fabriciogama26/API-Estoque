import { formatHhtValue, computeHhtCalculado, computeHhtFinal, normalizeModo } from '../../../../utils/hhtMensalUtils.js'
import { ModoHelpButton } from './ModoHelpButton.jsx'

export function HhtMensalForm({
  form,
  centrosServico,
  onChange,
  onSubmit,
  onCancel,
  isSaving,
  isEditing,
  error,
  savedHhtCalculado,
  savedHhtFinal,
}) {
  const modo = normalizeModo(form.modo)
  const previewCalculado = computeHhtCalculado(form)
  const previewFinal = computeHhtFinal(form)

  const hhtCalculadoDisplay =
    savedHhtCalculado !== undefined && savedHhtCalculado !== null ? savedHhtCalculado : previewCalculado
  const hhtFinalDisplay =
    savedHhtFinal !== undefined && savedHhtFinal !== null ? savedHhtFinal : previewFinal

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit()
  }

  const handleInput = (field) => (event) => {
    onChange(field, event.target.value)
  }

  return (
    <section className="card">
      <header className="card__header">
        <h2>{isEditing ? 'Editando HHT mensal' : 'Cadastrar HHT mensal'}</h2>
      </header>
      <form className={`form${isEditing ? ' form--editing' : ''}`} onSubmit={handleSubmit}>
        <p className="feedback">Informe o HHT do mes por centro de servico (modo manual, simples ou completo).</p>

        {error ? <p className="feedback feedback--error">{error}</p> : null}

        <div className="form__grid">
          <label className="field">
            <span>Mes de referencia <span className="asterisco">*</span> </span>
            <input
              type="month"
              value={form.mesRefMonth}
              onChange={handleInput('mesRefMonth')}
              required
              disabled={isSaving}
            />
          </label>

          <label className="field">
            <span>Centro de servico <span className="asterisco">*</span></span>
            <select
              value={form.centroServicoId}
              onChange={handleInput('centroServicoId')}
              required
              disabled={isSaving}
            >
              <option value="">Selecione...</option>
              {(centrosServico ?? []).map((centro) => (
                <option key={centro.id} value={centro.id}>
                  {centro.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <div className="field__label-with-help">
              <span>Modo <span className="asterisco">*</span></span>
              <ModoHelpButton />
            </div>
            <select value={modo} onChange={handleInput('modo')} disabled={isSaving}>
              <option value="manual">Manual (digita HHT)</option>
              <option value="simples">Simples (pessoas x horas base)</option>
              <option value="completo">Completo (descontos/extras/escala)</option>
            </select>
          </label>

          {modo === 'manual' ? (
            <label className="field field--accent">
              <span>HHT informado <span className="asterisco">*</span></span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.hhtInformado}
                onChange={handleInput('hhtInformado')}
                required
                disabled={isSaving}
                placeholder="Ex.: 1234.50"
              />
            </label>
          ) : null}

          {modo !== 'manual' ? (
            <>
              <label className="field">
                <span>Qtd. pessoas <span className="asterisco">*</span></span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.qtdPessoas}
                  onChange={handleInput('qtdPessoas')}
                  required
                  disabled={isSaving}
                  placeholder="Ex.: 10"
                />
              </label>

              <label className="field">
                <span>Horas mes base <span className="asterisco">*</span></span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.horasMesBase}
                  onChange={handleInput('horasMesBase')}
                  required
                  disabled={isSaving}
                  placeholder="Ex.: 176"
                />
              </label>
            </>
          ) : null}

          {modo === 'completo' ? (
            <>
              <label className="field">
                <span>Fator escala <span className="asterisco">*</span></span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.escalaFactor}
                  onChange={handleInput('escalaFactor')}
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Horas afastamento <span className="asterisco">*</span></span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.horasAfastamento}
                  onChange={handleInput('horasAfastamento')}
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Horas ferias <span className="asterisco">*</span></span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.horasFerias}
                  onChange={handleInput('horasFerias')}
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Horas treinamento <span className="asterisco">*</span></span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.horasTreinamento}
                  onChange={handleInput('horasTreinamento')}
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Outros descontos</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.horasOutrosDescontos}
                  onChange={handleInput('horasOutrosDescontos')}
                  disabled={isSaving}
                />
              </label>

              <label className="field">
                <span>Horas extras</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.horasExtras}
                  onChange={handleInput('horasExtras')}
                  disabled={isSaving}
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="form__notice">
          <div>
            <strong>HHT calculado</strong>: {formatHhtValue(hhtCalculadoDisplay)}
            <div className="data-table__muted">Preview na tela; o valor final sempre e calculado no Supabase.</div>
          </div>
          <div>
            <strong>HHT final</strong>: {formatHhtValue(hhtFinalDisplay)}
          </div>
        </div>

        <div className="form__actions form__actions--split">
          <div className="form__actions-group">
            <button type="submit" className="button button--primary" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            {isEditing ? (
              <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  )
}
