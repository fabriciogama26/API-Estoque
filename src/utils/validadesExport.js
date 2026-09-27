import { buildCsv, downloadCsv } from './csvExport.js'
import {
  formatDate,
  resolveCategoriaLabel,
  resolveExigenciaLabel,
  resolveStatusMeta,
} from './validadesUtils.js'

const HEADERS = [
  'Colaborador',
  'Matricula',
  'Cargo',
  'Setor',
  'Centro de servico',
  'Centro de custo',
  'Requisito',
  'Codigo',
  'Categoria',
  'Exigencia',
  'Origem da exigencia',
  'Data de realizacao',
  'Vencimento',
  'Dias restantes',
  'Status',
  'Numero do documento',
  'Entidade emissora',
]

// Datas em dd/mm/aaaa e dias como inteiro para o Excel reconhecer como data/numero.
const formatCsvDate = (value) => (value ? formatDate(value) : '')

export const buildValidadesCsv = (itens = []) =>
  buildCsv(
    HEADERS,
    (Array.isArray(itens) ? itens : []).map((item) => [
      item.pessoa_nome,
      item.matricula,
      item.cargo,
      item.setor,
      item.centro_servico,
      item.centro_custo,
      item.requisito_nome,
      item.requisito_codigo,
      resolveCategoriaLabel(item.categoria),
      resolveExigenciaLabel(item.exigencia),
      Array.isArray(item.origens) ? item.origens.join(' | ') : '',
      formatCsvDate(item.data_realizacao),
      formatCsvDate(item.data_vencimento),
      item.dias_restantes ?? '',
      resolveStatusMeta(item.status).label,
      item.numero_documento,
      item.entidade_emissora,
    ]),
  )

export const downloadValidadesCsv = (itens = [], filename = 'controle-validades.csv') => {
  downloadCsv(buildValidadesCsv(itens), filename)
}
