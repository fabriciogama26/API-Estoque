import { formatDateTime } from '../../utils/validadesUtils.js'

export function ValidadesConfigCard({ config, form, podeEditar, isSaving, feedback, onChange, onSubmit }) {
  const desabilitado = !podeEditar || isSaving

  return (
    <section className="card">
      <header className="card__header">
        <h2>Configuracao do controle de validades</h2>
      </header>
      <form className="form" onSubmit={onSubmit}>
        <div className="form__grid form__grid--two">
          <label className="field">
            <span>Janela critica (dias)</span>
            <input
              type="number"
              min="1"
              max="90"
              name="janela_critica_dias"
              value={form.janela_critica_dias}
              onChange={onChange}
              disabled={desabilitado}
            />
            <small className="data-table__muted">Faltando de 1 ate este numero de dias, o status vira "Proximo do vencimento".</small>
          </label>

          <label className="field">
            <span>Tolerancia do alerta de vencimento (dias)</span>
            <input
              type="number"
              min="0"
              max="30"
              name="alerta_vencimento_tolerancia_dias"
              value={form.alerta_vencimento_tolerancia_dias}
              onChange={onChange}
              disabled={desabilitado}
            />
            <small className="data-table__muted">Se o envio falhar no dia do vencimento, tenta enviar ate estes dias depois.</small>
          </label>

          <label className="field field--checkbox">
            <input type="checkbox" name="alertas_ativos" checked={Boolean(form.alertas_ativos)} onChange={onChange} disabled={desabilitado} />
            <span>Alertas por e-mail ativos</span>
          </label>

          <label className="field field--checkbox">
            <input
              type="checkbox"
              name="alerta_janela_ativo"
              checked={Boolean(form.alerta_janela_ativo)}
              onChange={onChange}
              disabled={desabilitado || !form.alertas_ativos}
            />
            <span>Alertar ao entrar na janela critica (uma vez)</span>
          </label>

          <label className="field field--checkbox">
            <input
              type="checkbox"
              name="alerta_vencimento_ativo"
              checked={Boolean(form.alerta_vencimento_ativo)}
              onChange={onChange}
              disabled={desabilitado || !form.alertas_ativos}
            />
            <span>Alertar no dia do vencimento (uma vez)</span>
          </label>

          <label className="field">
            <span>Fuso horario</span>
            <input name="timezone" value={form.timezone} onChange={onChange} disabled={desabilitado} />
          </label>

          {podeEditar ? (
            <label className="field field--full">
              <span>
                Motivo da alteracao <span className="asterisco">*</span>
              </span>
              <textarea name="motivo" value={form.motivo} onChange={onChange} rows="2" disabled={isSaving} />
            </label>
          ) : null}
        </div>

        <p className="data-table__muted">
          Destinatarios: administradores do tenant com e-mail cadastrado.
          {config?.atualizado_em
            ? ` Ultima alteracao em ${formatDateTime(config.atualizado_em)} por ${config.atualizado_por_nome || '-'}.`
            : ' Usando valores padrao.'}
        </p>

        {feedback ? (
          <p className={`feedback ${feedback.tipo === 'error' ? 'feedback--error' : 'feedback--success'}`}>{feedback.mensagem}</p>
        ) : null}

        {podeEditar ? (
          <div className="form__actions">
            <button type="submit" className="button button--primary" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar configuracao'}
            </button>
          </div>
        ) : (
          <p className="data-table__muted">Somente leitura: alterar exige a permissao de regras de validade.</p>
        )}
      </form>
    </section>
  )
}
