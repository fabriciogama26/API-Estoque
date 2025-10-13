import { GRUPO_MATERIAL_CALCADO, GRUPO_MATERIAL_VESTIMENTA } from '../../rules/MateriaisRules.js'

const normalize = (value) =>
  value
    ? value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : ''

const isGrupo = (value, target) => normalize(value) === normalize(target)

export function MateriaisForm({
  form,
  onChange,
  onSubmit,
  isSaving,
  editingMaterial,
  onCancel,
  error,
  materialGroups = [],
  isLoadingGroups = false,
  groupsError = null,
}) {
  const isCalcado = isGrupo(form.grupoMaterial, GRUPO_MATERIAL_CALCADO)
  const isVestimenta = isGrupo(form.grupoMaterial, GRUPO_MATERIAL_VESTIMENTA)
  const groupOptions = Array.from(
    new Set([...(materialGroups || []), form.grupoMaterial].filter(Boolean))
  )

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form__grid form__grid--two">
        <label className="field">
          <span>EPI <span className="asterisco">*</span></span>
          <input
            name="nome"
            value={form.nome}
            onChange={onChange}
            required
            placeholder="Capacete"
          />
        </label>
        <label className="field">
          <span>Fabricante <span className="asterisco">*</span></span>
          <input
            name="fabricante"
            value={form.fabricante}
            onChange={onChange}
            required
            placeholder="3M"
          />
        </label>
        <label className="field">
          <span>Validade (dias) <span className="asterisco">*</span></span>
          <input
            type="number"
            min="1"
            name="validadeDias"
            value={form.validadeDias}
            onChange={onChange}
            placeholder="200"
            required
          />
        </label>
        <label className="field">
          <span>C.A.</span>
          <input
            name="ca"
            value={form.ca}
            onChange={onChange}
            placeholder="12345"
            inputMode="numeric"
          />
        </label>
        <label className="field">
          <span>Valor unitario <span className="asterisco">*</span></span>
          <input
            name="valorUnitario"
            value={form.valorUnitario}
            onChange={onChange}
            placeholder="R$ 0,00"
            inputMode="decimal"
            required
          />
        </label>
        <label className="field">
          <span>Grupo de material <span className="asterisco">*</span></span>
          <select
            name="grupoMaterial"
            value={form.grupoMaterial}
            onChange={onChange}
            required
            disabled={isLoadingGroups && !materialGroups.length}
          >
            <option value="">
              {isLoadingGroups ? 'Carregando grupos...' : 'Selecione um grupo'}
            </option>
            {groupOptions.map((grupo) => (
              <option key={grupo} value={grupo}>
                {grupo}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            Numero calcado {isCalcado ? <span className="asterisco">*</span> : null}
          </span>
          <input
            name="numeroCalcado"
            value={form.numeroCalcado}
            onChange={onChange}
            placeholder="Ex: 40"
            inputMode="numeric"
            pattern="[0-9]*"
            required={isCalcado}
            disabled={!isCalcado}
          />
        </label>
        <label className="field">
          <span>
            Numero vestimenta {isVestimenta ? <span className="asterisco">*</span> : null}
          </span>
          <input
            name="numeroVestimenta"
            value={form.numeroVestimenta}
            onChange={onChange}
            placeholder="Ex: M"
            required={isVestimenta}
            disabled={!isVestimenta}
          />
        </label>
      </div>
      {groupsError ? <p className="feedback feedback--error">{groupsError}</p> : null}
      {error ? <p className="feedback feedback--error">{error}</p> : null}
      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving ? 'Salvando...' : editingMaterial ? 'Salvar alterações' : 'Salvar material'}
        </button>
        {editingMaterial ? (
          <button
            type="button"
            className="button button--ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancelar edição
          </button>
        ) : null}
      </div>
    </form>
  )
}
