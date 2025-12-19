import { useMemo } from 'react'
import { formatDateTimeLabel, normalizeText } from '../../../utils/acidentesUtils.js'
import { formatPessoaDetail, formatPessoaSummary } from '../../../utils/saidasUtils.js'
import { AcidentesFormAgentes } from './AcidentesFormAgentes.jsx'
import { AcidentesFormLesoes } from './AcidentesFormLesoes.jsx'
import { AcidentesFormPartes } from './AcidentesFormPartes.jsx'

export function AcidentesForm({
  form,
  onChange,
  onSubmit,
  isSaving,
  editingAcidente,
  onCancel,
  error,
  pessoasError,
  isLoadingPessoas = false,
  pessoaSearchValue = '',
  pessoaSuggestions = [],
  pessoaDropdownOpen = false,
  isSearchingPessoas = false,
  pessoaSearchError,
  onPessoaInputChange = () => {},
  onPessoaSelect = () => {},
  onPessoaFocus = () => {},
  onPessoaBlur = () => {},
  onPessoaClear = () => {},
  locais = [],
  locaisError,
  isLoadingLocais = false,
  agentes = [],
  agentesError,
  isLoadingAgentes = false,
  tipos = [],
  tiposError,
  isLoadingTipos = false,
  lesoes = [],
  lesoesError,
  isLoadingLesoes = false,
  partes = [],
  partesError,
  isLoadingPartes = false,
  centrosServico = [],
}) {
  const handleEsocialChange = (event) => {
    const checked = event.target.checked
    const nextValue = checked ? new Date().toISOString() : ''
    onChange({
      target: {
        name: 'dataEsocial',
        value: nextValue,
      },
    })
  }

  const handleSesmtChange = (event) => {
    const checked = event.target.checked
    onChange({
      target: {
        name: 'sesmt',
        value: checked,
      },
    })
    onChange({
      target: {
        name: 'dataSesmt',
        value: checked ? form.dataSesmt || new Date().toISOString() : '',
      },
    })
  }

  const dataEsocialLabel = form.dataEsocial ? formatDateTimeLabel(form.dataEsocial) : ''
  const dataSesmtLabel = form.dataSesmt ? formatDateTimeLabel(form.dataSesmt) : ''

  const centroServicoOptions = useMemo(
    () =>
      Array.from(
        new Set([...(centrosServico || []), form.centroServico].map(normalizeText).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [centrosServico, form.centroServico],
  )

  const localOptions = useMemo(
    () =>
      Array.from(new Set([...(locais || []), form.local].map(normalizeText).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [locais, form.local],
  )

  const matriculaPlaceholder = isLoadingPessoas
    ? 'Carregando colaboradores...'
    : 'Digite para buscar colaborador'
  const centroServicoPlaceholder = isLoadingPessoas
    ? 'Carregando centros...'
    : 'Selecione o centro de servico'
  const localPlaceholder = isLoadingLocais ? 'Carregando locais...' : 'Selecione o local do acidente'

  const shouldDisableCentroServico = isLoadingPessoas && centroServicoOptions.length === 0
  const shouldDisableLocal = isLoadingLocais && localOptions.length === 0

  return (
    <section className="card">
      <header className="card__header">
        <h2>Cadastro de acidente</h2>
      </header>
      <form className={`form${editingAcidente ? ' form--editing' : ''}`} onSubmit={onSubmit}>
        <div className="form__grid form__grid--two">
        <label className="field autocomplete">
          <span>
            Matrícula <span className="asterisco">*</span>
          </span>
          <div className="autocomplete__control">
            <input
              className="autocomplete__input"
              value={pessoaSearchValue}
              onChange={onPessoaInputChange}
              onFocus={onPessoaFocus}
              onBlur={onPessoaBlur}
              placeholder={matriculaPlaceholder}
              required
            />
            {pessoaSearchValue ? (
              <button type="button" className="autocomplete__clear" onClick={onPessoaClear}>
                &times;
              </button>
            ) : null}
            {pessoaDropdownOpen &&
            !form.matricula &&
            (isSearchingPessoas || pessoaSearchError || pessoaSuggestions.length > 0) ? (
              <div className="autocomplete__dropdown" role="listbox">
                {isSearchingPessoas ? (
                  <p className="autocomplete__feedback">Buscando pessoas...</p>
                ) : null}
                {!isSearchingPessoas && pessoaSearchError ? (
                  <p className="autocomplete__feedback autocomplete__feedback--error">
                    {pessoaSearchError}
                  </p>
                ) : null}
                {!isSearchingPessoas && !pessoaSearchError && pessoaSuggestions.length === 0 ? (
                  <p className="autocomplete__feedback">Nenhum colaborador encontrado.</p>
                ) : null}
                {pessoaSuggestions.map((item) => (
                  <button
                    type="button"
                    key={item.id ?? item.matricula ?? item.nome}
                    className="autocomplete__item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onPessoaSelect(item)}
                  >
                    <span className="autocomplete__primary">
                      {formatPessoaSummary(item) || item.nome || item.matricula || 'Pessoa sem nome'}
                    </span>
                    <span className="autocomplete__secondary">
                      {formatPessoaDetail(item) || item.cargo || item.matricula || ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </label>
        <label className="field">
          <span>Nome <span className="asterisco">*</span></span>
          <input name="nome" value={form.nome} readOnly required placeholder="Fulano de Tal" />
        </label>
        <label className="field">
          <span>Cargo <span className="asterisco">*</span></span>
          <input name="cargo" value={form.cargo} readOnly required placeholder="Operador" />
        </label>
        <label className="field">
          <span>Data do Acidente <span className="asterisco">*</span></span>
          <input
            type="datetime-local"
            name="data"
            value={form.data}
            onChange={onChange}
            required
            step="60"
          />
          <small className="field__hint">Informe data e hora do acidente.</small>
        </label>
        <label className="field field--checkbox">
          <input
            type="checkbox"
            name="dataEsocial"
            checked={Boolean(form.dataEsocial)}
            onChange={handleEsocialChange}
          />
          <span>Lancado eSOCIAL</span>
          {dataEsocialLabel ? (
            <small className="field__hint">Registrado em {dataEsocialLabel}</small>
          ) : null}
        </label>
        <label className="field field--checkbox">
          <input type="checkbox" name="sesmt" checked={Boolean(form.sesmt)} onChange={handleSesmtChange} />
          <span>Lancado SESMT</span>
          {dataSesmtLabel ? (
            <small className="field__hint">Registrado em {dataSesmtLabel}</small>
          ) : null}
        </label>
        <label className="field">
          <span>Dias Perdidos <span className="asterisco">*</span></span>
          <input
            type="number"
            min="0"
            step="1"
            name="diasPerdidos"
            value={form.diasPerdidos}
            onChange={onChange}
            placeholder="0"
            required
          />
        </label>
        <label className="field">
          <span>Dias Debitados <span className="asterisco">*</span></span>
          <input
            type="number"
            min="0"
            step="1"
            name="diasDebitados"
            value={form.diasDebitados}
            onChange={onChange}
            placeholder="0"
            required
          />
        </label>
        <label className="field field--accent">
          <span>
            HHT <span className="asterisco">*</span>
          </span>
          <input
            type="number"
            min="0"
            step="1"
            name="hht"
            value={form.hht}
            placeholder="0"
            required
            inputMode="numeric"
            readOnly
            disabled
          />
        </label>
        <label className="field">
          <span>Centro de servico <span className="asterisco">*</span></span>
          <select
            name="centroServico"
            value={form.centroServico}
            onChange={onChange}
            required
            disabled={shouldDisableCentroServico}
          >
            <option value="">{centroServicoPlaceholder}</option>
            {centroServicoOptions.map((centro) => (
              <option key={centro} value={centro}>
                {centro}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Local <span className="asterisco">*</span></span>
          <select
            name="local"
            value={form.local}
            onChange={onChange}
            required
            disabled={shouldDisableLocal}
          >
            <option value="">{localPlaceholder}</option>
            {localOptions.map((local) => (
              <option key={local} value={local}>
                {local}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>CAT</span>
          <input
            type="text"
            name="cat"
            value={form.cat}
            onChange={onChange}
            placeholder="000000"
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </label>
        <label className="field field--full">
          <span>Observacao</span>
          <textarea
            name="observacao"
            value={form.observacao ?? ''}
            onChange={onChange}
            placeholder="Detalhes adicionais do acidente"
            rows={3}
          />
        </label>
      </div>

      <div className="form__grid">
        <label className="field">
          <span>CID</span>
          <input name="cid" value={form.cid} onChange={onChange} placeholder="S93" />
        </label>

        <AcidentesFormAgentes
          form={form}
          onChange={onChange}
          agentes={agentes}
          isLoadingAgentes={isLoadingAgentes}
          tipos={tipos}
          isLoadingTipos={isLoadingTipos}
          inline
        />

        <AcidentesFormLesoes
          form={form}
          onChange={onChange}
          lesoes={lesoes}
          isLoadingLesoes={isLoadingLesoes}
          inline
        />

        <AcidentesFormPartes
          form={form}
          onChange={onChange}
          partes={partes}
          isLoadingPartes={isLoadingPartes}
          inline
        />
      </div>

      {pessoasError ? <p className="feedback feedback--error">{pessoasError}</p> : null}
      {agentesError ? <p className="feedback feedback--error">{agentesError}</p> : null}
      {tiposError ? <p className="feedback feedback--error">{tiposError}</p> : null}
      {locaisError ? <p className="feedback feedback--error">{locaisError}</p> : null}
      {lesoesError ? <p className="feedback feedback--error">{lesoesError}</p> : null}
      {partesError ? <p className="feedback feedback--error">{partesError}</p> : null}
      {error ? <p className="feedback feedback--error">{error}</p> : null}
      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={isSaving}>
          {isSaving ? 'Salvando...' : editingAcidente ? 'Salvar alteracoes' : 'Registrar acidente'}
        </button>
        {editingAcidente ? (
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSaving}>
            Cancelar edicao
          </button>
        ) : null}
      </div>
      </form>
    </section>
  )
}
