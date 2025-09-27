export function MateriaisForm({ form, onChange, onSubmit, isSaving, editingMaterial, onCancel, error }) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form__grid form__grid--two">
        <label className="field">
          <span>EPI  <span className="asterisco">*</span></span>
          <input name="nome" value={form.nome} onChange={onChange} required placeholder="Capacete" />
        </label>
        <label className="field">
          <span>Fabricante  <span className="asterisco">*</span></span>
          <input name="fabricante" value={form.fabricante} onChange={onChange} required placeholder="3M" />
        </label>
        <label className="field">
          <span>Validade (dias)  <span className="asterisco">*</span></span>
          <input type="number" min="1" name="validadeDias" value={form.validadeDias} onChange={onChange} placeholder="200" required />
        </label>
        <label className="field">
          <span>C.A.</span>
          <input name="ca" value={form.ca} onChange={onChange} placeholder="12345" inputMode="numeric" />
        </label>
        <label className="field">
          <span>Valor unitário  <span className="asterisco">*</span></span>
          <input
            name="valorUnitario"
            value={form.valorUnitario}
            onChange={onChange}
            placeholder="R$ 0,00"
            inputMode="decimal"
            required
          />
        </label>
      </div>
      {error ? <p className="feedback feedback--error">{error}</p> : null}
      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving ? 'Salvando...' : editingMaterial ? 'Salvar alteracões' : 'Salvar material'}
        </button>
        {editingMaterial ? (
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
            Cancelar edicao
          </button>
        ) : null}
      </div>
    </form>
  )
}
