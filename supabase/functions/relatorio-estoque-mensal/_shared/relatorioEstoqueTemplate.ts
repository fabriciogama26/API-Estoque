type EmpresaInfo = {
  nome?: string
  documento?: string
  endereco?: string
  contato?: string
  logoUrl?: string
  logoSecundarioUrl?: string
}

type RelatorioContexto = Record<string, unknown>

function escapeHtml(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeText(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function splitLines(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

const UUID_REGEX = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

function sanitizeListLine(line: string) {
  let cleaned = normalizeText(line)
  if (!cleaned) return ''
  cleaned = cleaned.replace(UUID_REGEX, '').replace(/\s{2,}/g, ' ').trim()
  if (cleaned.includes('|')) {
    cleaned = cleaned
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' | ')
  }
  return cleaned
}

function renderList(value: unknown) {
  const linhas = splitLines(value)
  if (!linhas.length) {
    return '<p class="relatorio-muted">Sem dados.</p>'
  }
  const items = linhas.map((linha) => `<li>${escapeHtml(sanitizeListLine(linha))}</li>`).join('')
  return `<ul class="relatorio-list">${items}</ul>`
}

function renderGrid(rows: Array<[string, unknown]>) {
  const linhas = rows
    .map(([label, value]) => {
      return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(normalizeText(value) || '-')}</td></tr>`
    })
    .join('')
  return `<table class="relatorio-grid">${linhas}</table>`
}

function renderEmpresa(empresa: EmpresaInfo = {}) {
  const logoPrincipal = empresa.logoUrl
    ? `<div class="empresa__logo"><img src="${escapeHtml(empresa.logoUrl)}" alt="Logo principal" /></div>`
    : ''
  const logoSecundario = empresa.logoSecundarioUrl
    ? `<div class="empresa__logo empresa__logo--secundaria"><img src="${escapeHtml(
        empresa.logoSecundarioUrl,
      )}" alt="Logo secundario" /></div>`
    : ''

  return `
    <div class="empresa">
      ${logoPrincipal}
      <div class="empresa__identidade">
        <div class="empresa__nome">${escapeHtml(empresa.nome || '')}</div>
        <div class="empresa__documento">${escapeHtml(empresa.documento || '')}</div>
        <div class="empresa__endereco">${escapeHtml(empresa.endereco || '')}</div>
        <div class="empresa__contato">${escapeHtml(empresa.contato || '')}</div>
      </div>
      ${logoSecundario}
    </div>
  `
}

function renderSection(title: string, content: string) {
  return `
    <section class="relatorio-section">
      <h2>${escapeHtml(title)}</h2>
      ${content}
    </section>
  `
}

export function buildRelatorioEstoqueHtml({
  contexto = {},
  empresa = {},
}: {
  contexto?: RelatorioContexto
  empresa?: EmpresaInfo
} = {}) {
  const titulo = 'Relatorio Mensal de Estoque'

  const identificacao = renderGrid([
    ['Mes de referencia', contexto.mes_referencia],
    ['Periodo analisado', `${contexto.periodo_inicio || '-'} a ${contexto.periodo_fim || '-'}`],
    ['Data de emissao', contexto.data_emissao],
  ])

  const resumoExecutivo = renderGrid([
    ['Total de movimentacoes', contexto.total_movimentacoes],
    ['Total de entradas', contexto.total_entradas],
    ['Total de saidas', contexto.total_saidas],
    ['Valor total movimentado', contexto.valor_total_movimentado],
    ['Alertas ativos', contexto.alertas_ativos],
    ['Nivel de risco geral', contexto.nivel_risco_geral],
    ['Materiais criticos', contexto.qtd_criticos],
    ['Status geral do estoque', contexto.status_estoque],
  ])

  const paretoQuantidade = renderSection(
    'Pareto 80/20 - Saida por quantidade',
    `
      ${renderGrid([
        ['Percentual pareto', contexto.percentual_pareto],
        ['Percentual materiais', contexto.percentual_materiais],
      ])}
      ${renderList(contexto.lista_pareto_quantidade)}
    `,
  )

  const riscoOperacional = renderSection(
    'Risco operacional',
    `
      ${renderGrid([
        ['Criticos', contexto.qtd_criticos],
        ['Em atencao', contexto.qtd_atencao],
        ['Controlados', contexto.qtd_controlados],
      ])}
      ${renderList(contexto.lista_materiais_criticos)}
    `,
  )

  const paretoFinanceiro = renderSection(
    'Pareto financeiro',
    `
      ${renderList(contexto.lista_pareto_valor)}
    `,
  )

  const consumo = renderSection(
    'Consumo por centro/setor',
    `
      ${renderList(contexto.lista_consumo_setor)}
    `,
  )

  const vencimentos = renderSection(
    'Vencidos / Vencendo / Excesso',
    `
      ${renderGrid([
        ['Vencidos', contexto.qtd_vencidos],
        ['Vencendo (ate 30 dias)', contexto.qtd_vencendo],
        ['Excesso', contexto.qtd_excesso],
      ])}
    `,
  )

  const cobertura = renderSection(
    'Cobertura por trabalhador',
    `
      ${renderGrid([
        ['Status', contexto.status_cobertura],
        ['Interpretacao', contexto.interpretacao_cobertura],
      ])}
    `,
  )

  const alertas = renderSection(
    'Sintese de alertas',
    `
      ${renderGrid([
        ['Materiais abaixo do minimo', contexto.qtd_abaixo_minimo],
        ['Riscos imediatos de ruptura', contexto.qtd_riscos_imediatos],
      ])}
    `,
  )

  const conclusao = renderSection(
    'Conclusao',
    `<div class="relatorio-highlight">${escapeHtml(normalizeText(contexto.status_final))}</div>`,
  )

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(titulo)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
      .relatorio-document { max-width: 960px; margin: 0 auto; }
      .empresa { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 16px; }
      .empresa__logo { max-width: 180px; }
      .empresa__logo img { max-width: 180px; max-height: 120px; display: block; }
      .empresa__logo.empresa__logo--secundaria { text-align: right; }
      .empresa__identidade { max-width: 60%; }
      .empresa__nome { font-size: 16px; font-weight: 600; }
      .empresa__documento, .empresa__endereco, .empresa__contato { font-size: 11px; }
      .titulo-principal { text-align: center; font-size: 15px; font-weight: 700; margin: 8px 0 14px; }
      .relatorio-section { margin-bottom: 16px; }
      .relatorio-section h2 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #1e293b; }
      .relatorio-grid { width: 100%; border-collapse: collapse; }
      .relatorio-grid th, .relatorio-grid td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 12px; text-align: left; }
      .relatorio-grid th { width: 45%; background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; color: #334155; }
      .relatorio-list { margin: 6px 0 0 18px; padding: 0; font-size: 12px; }
      .relatorio-list li { margin-bottom: 4px; }
      .relatorio-muted { font-size: 12px; color: #64748b; margin: 6px 0 0; }
      .relatorio-highlight { padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="relatorio-document">
      ${renderEmpresa(empresa)}
      <div class="titulo-principal">${escapeHtml(titulo)}</div>
      ${renderSection('Identificacao', identificacao)}
      ${renderSection('Resumo executivo', resumoExecutivo)}
      ${paretoQuantidade}
      ${riscoOperacional}
      ${paretoFinanceiro}
      ${consumo}
      ${vencimentos}
      ${cobertura}
      ${alertas}
      ${conclusao}
    </div>
  </body>
</html>`
}
