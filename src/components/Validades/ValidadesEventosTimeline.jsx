import { STATUS_REGISTRO_LABELS } from '../../config/ValidadesConfig.js'
import { formatDate, formatDateTime, formatValidade, resolveHistoricoAcaoLabel } from '../../utils/validadesUtils.js'

// Requisito guarda a validade em `possui_validade`; a realizacao guarda o snapshot.
const validadeDoEvento = (dados) => {
  if ('possui_validade' in dados) return formatValidade(dados)
  if ('possui_validade_snapshot' in dados) {
    return formatValidade({
      possui_validade: dados.possui_validade_snapshot,
      validade_quantidade: dados.validade_quantidade_snapshot,
      validade_unidade: dados.validade_unidade_snapshot,
    })
  }
  return ''
}

// Campos relevantes para mostrar "de -> para" em cada evento de auditoria.
const CAMPOS = [
  { key: 'nome', label: 'Nome' },
  { key: 'codigo', label: 'Codigo' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'validade', label: 'Validade', valor: validadeDoEvento },
  { key: 'ativo', label: 'Ativo' },
  { key: 'data_realizacao', label: 'Data de realizacao', data: true },
  { key: 'data_vencimento', label: 'Vencimento', data: true },
  { key: 'numero_documento', label: 'Numero do documento' },
  { key: 'entidade_emissora', label: 'Entidade emissora' },
  {
    key: 'status_registro',
    label: 'Situacao do registro',
    valor: (dados) => STATUS_REGISTRO_LABELS[dados.status_registro] || dados.status_registro || '',
  },
  { key: 'janela_critica_dias', label: 'Janela critica (dias)' },
  { key: 'alertas_ativos', label: 'Alertas ativos' },
  { key: 'valida_ate', label: 'Dispensa valida ate', data: true },
]

const resolverValor = (campo, dados) => {
  if (!dados) return ''
  if (campo.valor) return campo.valor(dados)
  const bruto = dados[campo.key]
  if (bruto === null || bruto === undefined) return ''
  if (typeof bruto === 'boolean') return bruto ? 'Sim' : 'Nao'
  if (campo.data) return formatDate(bruto)
  return String(bruto)
}

const listarMudancas = (evento) =>
  CAMPOS.map((campo) => {
    const de = resolverValor(campo, evento.antes)
    const para = resolverValor(campo, evento.depois)
    if (evento.antes && de === para) return null
    if (!evento.antes && !para) return null
    return { campo: campo.label, de: evento.antes ? de || '-' : null, para: para || '-' }
  }).filter(Boolean)

export function ValidadesEventosTimeline({ eventos = [] }) {
  if (!eventos.length) {
    return <p className="feedback">Nenhum evento registrado.</p>
  }

  return (
    <div className="validades-timeline">
      {eventos.map((evento) => {
        const mudancas = listarMudancas(evento)
        return (
          <article key={evento.id} className="validades-timeline__entry">
            <header className="validades-timeline__header">
              <strong>{resolveHistoricoAcaoLabel(evento.acao)}</strong>
              <span className="data-table__muted">
                {evento.ator_nome || 'sistema'} | {formatDateTime(evento.criado_em)}
              </span>
            </header>
            {evento.motivo ? (
              <p className="validades-timeline__note">
                <strong>Motivo:</strong> {evento.motivo}
              </p>
            ) : null}
            {mudancas.length ? (
              <ul className="validades-timeline__changes">
                {mudancas.map((mudanca) => (
                  <li key={mudanca.campo}>
                    <strong>{mudanca.campo}:</strong>{' '}
                    {mudanca.de !== null ? `${mudanca.de} -> ${mudanca.para}` : mudanca.para}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
