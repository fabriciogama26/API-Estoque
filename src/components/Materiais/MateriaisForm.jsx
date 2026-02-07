import { useState } from 'react'
import { AddIcon } from '../icons.jsx'
import { GrupoMaterialHelpButton } from './GrupoMaterialHelpButton.jsx'
import {
  GRUPO_MATERIAL_CALCADO,
  GRUPO_MATERIAL_VESTIMENTA,
  GRUPO_MATERIAL_PROTECAO_MAOS,
} from '../../routes/rules/MateriaisRules.js'
import {
  normalizeSelectionItem,
  normalizeSelectionList,
} from '../../utils/selectionUtils.js'

const normalize = (value) =>
  value
    ? value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    : ''

const normalizeGrupo = (value) => {
  const base = normalize(value)
  return base.endsWith('s') ? base.slice(0, -1) : base
}

const isGrupo = (value, target) => normalizeGrupo(value) === normalizeGrupo(target)

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
  materialItems = [],
  isLoadingItems = false,
  itemsError = null,
  fabricanteOptions = [],
  isLoadingFabricantes = false,
  fabricanteError = null,
  caracteristicaOptions = [],
  isLoadingCaracteristicas = false,
  caracteristicaError = null,
  corOptions = [],
  isLoadingCores = false,
  corError = null,
  calcadoOptions = [],
  isLoadingCalcado = false,
  calcadoError = null,
  tamanhoOptions = [],
  isLoadingTamanho = false,
  tamanhoError = null,
  onAddCaracteristica,
  onRemoveCaracteristica,
  onAddCor,
  onRemoveCor,
}) {
  const grupoAtualNome = form.grupoMaterialNome || form.grupoMaterial || ''
  const grupoAtualId = form.grupoMaterialId || grupoAtualNome
  const grupoAtual = normalizeSelectionItem({ id: grupoAtualId, nome: grupoAtualNome })
  const isCalcado = isGrupo(grupoAtualNome, GRUPO_MATERIAL_CALCADO)
  const isVestimenta =
    isGrupo(grupoAtualNome, GRUPO_MATERIAL_VESTIMENTA) ||
    isGrupo(grupoAtualNome, GRUPO_MATERIAL_PROTECAO_MAOS)
  const groupOptions = normalizeSelectionList(
    [...(materialGroups || []), grupoAtual].filter(Boolean),
  )
  const itemAtual = normalizeSelectionItem({
    id: form.nome,
    nome: form.nome,
  })
  const itemOptions = normalizeSelectionList(
    [...(materialItems || []), itemAtual].filter(Boolean),
  )
  const fabricanteAtual = normalizeSelectionItem({
    id: form.fabricante,
    nome: form.fabricanteNome || form.fabricante || '',
  })
  const fabricanteLista = normalizeSelectionList(
    [...(fabricanteOptions || []), fabricanteAtual].filter(Boolean),
  )
  const caracteristicasSelecionadas = Array.isArray(form.caracteristicaEpi)
    ? form.caracteristicaEpi
        .map((item) =>
          typeof item === 'string'
            ? { id: item, nome: item }
            : { id: item?.id ?? item?.nome ?? '', nome: item?.nome ?? '' }
        )
        .filter((item) => item.nome)
        .sort((a, b) => a.nome.localeCompare(b.nome))
    : []
  const coresSelecionadas = Array.isArray(form.cores)
    ? form.cores
        .map((item) =>
          typeof item === 'string'
            ? { id: item, nome: item }
            : { id: item?.id ?? item?.nome ?? '', nome: item?.nome ?? '' }
        )
        .filter((item) => item.nome)
        .sort((a, b) => a.nome.localeCompare(b.nome))
    : []
  const [caracteristicaSelecionada, setCaracteristicaSelecionada] = useState('')
  const [corSelecionada, setCorSelecionada] = useState('')

  return (
    <section className="card">
      <header className="card__header">
        <h2>Cadastro de Materiais</h2>
      </header>
      <form className={`form${editingMaterial ? ' form--editing' : ''}`} onSubmit={onSubmit}>
        <div className="form__grid form__grid--two">
        <div className="field">
          <div className="field__label-row">
            <label className="field__label-text field__label-text--strong" htmlFor="grupoMaterialId">
              Grupo de material <span className="asterisco">*</span>
            </label>
            <GrupoMaterialHelpButton />
          </div>
          <select
            id="grupoMaterialId"
            name="grupoMaterialId"
            value={form.grupoMaterialId || ''}
            onChange={onChange}
            required
            disabled={isLoadingGroups && !materialGroups.length}
          >
            <option value="">
              {isLoadingGroups ? 'Carregando grupos...' : 'Selecione um grupo'}
            </option>
            {groupOptions.map((grupo) => (
              <option key={grupo.id ?? grupo.nome} value={grupo.id ?? grupo.nome}>
                {grupo.nome}
              </option>
            ))}
          </select>
        </div>
        <label className="field">
          <span>Material <span className="asterisco">*</span></span>
          <select
            name="nome"
            value={form.nome || ''}
            onChange={onChange}
            required
            disabled={!form.grupoMaterialId || (isLoadingItems && !itemOptions.length)}
          >
            <option value="">
              {isLoadingItems
                ? 'Carregando Material...'
                : form.grupoMaterialId
                  ? itemOptions.length
                    ? 'Selecione o Material'
                    : 'Nenhum Material cadastrado para o grupo'
                  : 'Selecione um grupo primeiro'}
            </option>
            {itemOptions.map((item) => (
              <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
          <label className="field">
            <span>Fabricante <span className="asterisco">*</span></span>
            <select
              name="fabricante"
              value={form.fabricante || ''}
              onChange={onChange}
              required
              disabled={isLoadingFabricantes && !fabricanteLista.length}
            >
            <option value="">
              {isLoadingFabricantes
                ? 'Carregando fabricantes...'
                : fabricanteLista.length
                ? 'Selecione o fabricante'
                : 'Nenhum fabricante disponível'}
            </option>
            {fabricanteLista.map((item) => (
              <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                {item.nome}
              </option>
            ))}
          </select>
          {fabricanteError ? <p className="feedback feedback--error">{fabricanteError}</p> : null}
        </label>
        <label className="field">
          <span>Característica <span className="asterisco">*</span></span>
          <div className="field__inline">
            <select
              value={caracteristicaSelecionada}
              onChange={(event) => setCaracteristicaSelecionada(event.target.value)}
              disabled={isLoadingCaracteristicas}
            >
              <option value="">
                {isLoadingCaracteristicas ? 'Carregando características...' : 'Selecione'}
              </option>
              {caracteristicaOptions.map((item) => (
                <option key={item.id ?? item.nome} value={item.id ?? item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                onAddCaracteristica?.(caracteristicaSelecionada)
                setCaracteristicaSelecionada('')
              }}
              disabled={!caracteristicaSelecionada}
              aria-label="Adicionar característica"
              title="Adicionar característica"
            >
              <AddIcon size={16} />
            </button>
          </div>
          {caracteristicasSelecionadas.length ? (
            <ul className="materiais-caracteristicas">
              {caracteristicasSelecionadas.map((item) => (
                <li key={item.id ?? item.nome}>
                  <span>{item.nome}</span>
                  <button
                    type="button"
                    className="materiais-caracteristicas__remove"
                    onClick={() => onRemoveCaracteristica?.(item.id ?? item.nome)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field__helper">Adicione todas as características do material.</p>
          )}
          {caracteristicaError ? (
            <p className="feedback feedback--error">{caracteristicaError}</p>
          ) : null}
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
          <span>Valor unitário <span className="asterisco">*</span></span>
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
          <span>
            Número calçado {isCalcado ? <span className="asterisco">*</span> : null}
          </span>
          <select
            name="numeroCalcado"
            value={form.numeroCalcado}
            onChange={onChange}
            required={isCalcado}
            disabled={!isCalcado || isLoadingCalcado}
          >
            <option value="">
              {isCalcado
                ? isLoadingCalcado
                  ? 'Carregando numerações...'
                  : 'Selecione o número'
                : 'Não se aplica ao grupo'}
            </option>
            {calcadoOptions.map((opcao) => (
              <option key={opcao.id ?? opcao.nome} value={opcao.id ?? opcao.nome}>
                {opcao.nome}
              </option>
            ))}
          </select>
          {calcadoError ? <p className="feedback feedback--error">{calcadoError}</p> : null}
        </label>
        <label className="field">
          <span>
            Tamanho {isVestimenta ? <span className="asterisco">*</span> : null}
          </span>
          <select
            name="numeroVestimenta"
            value={form.numeroVestimenta}
            onChange={onChange}
            required={isVestimenta}
            disabled={!isVestimenta || isLoadingTamanho}
          >
            <option value="">
              {isVestimenta
                ? isLoadingTamanho
                  ? 'Carregando tamanhos...'
                  : 'Selecione o tamanho'
                : 'Não se aplica ao grupo'}
            </option>
            {tamanhoOptions.map((opcao) => (
              <option key={opcao.id ?? opcao.nome} value={opcao.id ?? opcao.nome}>
                {opcao.nome}
              </option>
            ))}
          </select>
          {tamanhoError ? <p className="feedback feedback--error">{tamanhoError}</p> : null}
        </label>
        <label className="field">
          <span>Cor <span className="asterisco">*</span></span>
          <div className="field__inline">
            <select
              value={corSelecionada}
              onChange={(event) => setCorSelecionada(event.target.value)}
              disabled={isLoadingCores}
            >
              <option value="">
                {isLoadingCores ? 'Carregando cores...' : 'Selecione'}
              </option>
              {corOptions.map((cor) => (
                <option key={cor.id ?? cor.nome} value={cor.id ?? cor.nome}>
                  {cor.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                onAddCor?.(corSelecionada)
                setCorSelecionada('')
              }}
              disabled={!corSelecionada}
              aria-label="Adicionar cor"
              title="Adicionar cor"
            >
              <AddIcon size={16} />
            </button>
          </div>
          {coresSelecionadas.length ? (
            <ul className="materiais-caracteristicas">
              {coresSelecionadas.map((item) => (
                <li key={item.id ?? item.nome}>
                  <span>{item.nome}</span>
                  <button
                    type="button"
                    className="materiais-caracteristicas__remove"
                    onClick={() => onRemoveCor?.(item.id ?? item.nome)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field__helper">Selecione uma ou mais cores para o material.</p>
          )}
          {corError ? <p className="feedback feedback--error">{corError}</p> : null}
        </label>
        <label className="field field--full">
          <span>Descrição</span>
          <textarea
            name="descricao"
            value={form.descricao}
            onChange={onChange}
            placeholder="Detalhes adicionais do material"
            rows={3}
          />
        </label>
      </div>
      {groupsError ? <p className="feedback feedback--error">{groupsError}</p> : null}
      {itemsError ? <p className="feedback feedback--error">{itemsError}</p> : null}
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
    </section>
  )
}
