function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function splitLines(value) {
  const raw = normalizeText(value)
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

const UUID_REGEX = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

function sanitizeListLine(line) {
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

function renderList(value, { emptyText = 'Sem dados.' } = {}) {
  const linhas = splitLines(value)
  if (!linhas.length) {
    return `<p class="relatorio-muted">${escapeHtml(emptyText)}</p>`
  }
  const items = linhas.map((linha) => `<li>${escapeHtml(sanitizeListLine(linha))}</li>`).join('')
  return `<ul class="relatorio-list">${items}</ul>`
}

function renderBullets(items = []) {
  const valid = (items || []).map((x) => normalizeText(x)).filter(Boolean)
  if (!valid.length) return ''
  const li = valid.map((t) => `<li>${escapeHtml(t)}</li>`).join('')
  return `<ul class="relatorio-bullets">${li}</ul>`
}

function renderGrid(rows = []) {
  const linhas = rows
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(normalizeText(value) || '-')}</td></tr>`)
    .join('')
  return `<table class="relatorio-grid">${linhas}</table>`
}

function renderEmpresa(empresa = {}) {
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

function renderSection(title, content) {
  return `
    <section class="relatorio-section">
      <h2>${escapeHtml(title)}</h2>
      ${content}
    </section>
  `
}

function renderSubTitle(text) {
  const t = normalizeText(text)
  if (!t) return ''
  return `<div class="relatorio-subtitle">${escapeHtml(t)}</div>`
}

function renderParagraph(text) {
  const t = normalizeText(text)
  if (!t) return ''
  return `<p class="relatorio-paragraph">${escapeHtml(t)}</p>`
}

export function buildRelatorioEstoqueHtml({ contexto = {}, empresa = {} } = {}) {
  const titulo = 'RELATÓRIO MENSAL DE ESTOQUE'

  // 1) Identificação
  const identificacao = renderGrid([
    ['Mês de referência', contexto.mes_referencia],
    ['Período analisado', `${contexto.periodo_inicio || '-'} a ${contexto.periodo_fim || '-'}`],
    ['Data de emissão', contexto.data_emissao],
  ])

  // 2) Resumo executivo (igual Word)
  const resumoExecutivoTexto = renderParagraph(
    `No período analisado, o estoque registrou ${normalizeText(contexto.total_movimentacoes)} movimentações, sendo ${normalizeText(
      contexto.total_entradas,
    )} entradas e ${normalizeText(contexto.total_saidas)} saídas, com valor total movimentado de ${normalizeText(
      contexto.valor_total_movimentado,
    )}.`,
  )

  const resumoExecutivoGrid = renderGrid([
    ['Alertas ativos', contexto.alertas_ativos],
    ['Nível de risco geral', contexto.nivel_risco_geral],
    ['Materiais críticos', contexto.qtd_materiais_criticos],
    ['Status geral do estoque', contexto.status_estoque],
  ])

  const resumoExecutivo = `${resumoExecutivoTexto}${resumoExecutivoGrid}`

  // 3) Pareto 80/20 – Saída por quantidade (ação operacional)
  const sec3 = renderSection(
    '3. Pareto 80/20 – Saída por quantidade (ação operacional)',
    `
      ${renderSubTitle('Conclusão objetiva')}
      ${renderParagraph(
        `A análise de Pareto indica que ${normalizeText(contexto.percentual_pareto)}% das saídas concentram-se em ${normalizeText(
          contexto.percentual_materiais,
        )}% dos materiais, evidenciando os itens de maior giro operacional.`,
      )}

      ${renderSubTitle('O que fazer:')}
      ${renderBullets([
        'Priorizar reposição rápida e estoque mínimo mais alto para esses materiais.',
        'Garantir fornecedores homologados e disponibilidade contínua.',
        'Monitorar consumo por equipe/obra para evitar uso indevido ou desperdício.',
      ])}

      ${renderSubTitle('Itens com maior giro')}
      ${renderList(contexto.lista_pareto_quantidade, { emptyText: 'Sem itens no Pareto por quantidade.' })}
      <div class="relatorio-footnote">(Material – Quantidade – % acumulado)</div>
    `,
  )

  // 4) Pareto por risco operacional (ação preventiva)
  const sec4 = renderSection(
    '4. Pareto por risco operacional (ação preventiva)',
    `
      ${renderSubTitle('Conclusão objetiva')}
      ${renderParagraph(
        'Os materiais classificados como Críticos representam itens cuja falta gera risco direto à segurança, paralisação de atividade ou não conformidade legal.',
      )}

      ${renderSubTitle('Classificação de risco:')}
      ${renderGrid([
        ['CRÍTICOS', contexto.qtd_criticos],
        ['EM ATENÇÃO', contexto.qtd_atencao],
        ['CONTROLADOS', contexto.qtd_controlados],
      ])}

      ${renderSubTitle('O que fazer:')}
      <div class="relatorio-block">
        <div class="relatorio-block__title">Críticos:</div>
        ${renderBullets(['Estoque mínimo obrigatório', 'Alerta automático de ruptura', 'Reposição antes do consumo médio'])}
      </div>
      <div class="relatorio-block">
        <div class="relatorio-block__title">Em atenção:</div>
        ${renderBullets(['Monitoramento semanal', 'Reavaliação de risco conforme tipo de serviço'])}
      </div>
      <div class="relatorio-block">
        <div class="relatorio-block__title">Controlados:</div>
        ${renderBullets(['Gestão simplificada', 'Reposição sob demanda'])}
      </div>

      ${renderSubTitle('Materiais críticos')}
      ${renderList(contexto.lista_materiais_criticos, { emptyText: 'Sem materiais críticos no período.' })}
    `,
  )

  // 5) Pareto financeiro – Para onde está indo o dinheiro (ação financeira)
  const sec5 = renderSection(
    '5. Pareto financeiro – Para onde está indo o dinheiro (ação financeira)',
    `
      ${renderSubTitle('Conclusão objetiva')}
      ${renderParagraph(
        'O Pareto financeiro mostra que poucos materiais concentram a maior parte do custo total, indicando onde estão os principais vetores de gasto do estoque.',
      )}

      ${renderSubTitle('O que fazer:')}
      ${renderBullets([
        'Focar negociação de preço e contrato apenas nos itens do topo do Pareto.',
        'Avaliar padronização de marcas/modelos para reduzir custo.',
        'Analisar se o consumo está compatível com: tipo de serviço, quantidade de equipes e produção executada.',
      ])}

      ${renderSubTitle('Regras de decisão aplicadas:')}
      ${renderBullets([
        'Alto valor + alta saída: controle rígido',
        'Alto valor + baixa saída: excesso/desperdício → ajuste de compra',
      ])}

      ${renderSubTitle('Materiais com maior impacto financeiro')}
      ${renderList(contexto.lista_pareto_valor, { emptyText: 'Sem itens no Pareto financeiro.' })}
    `,
  )

  // 6) Consumo por setor / centro de serviço
  const sec6 = renderSection(
    '6. Consumo por setor / centro de serviço',
    `
      ${renderParagraph('O consumo concentrou-se nos seguintes centros/setores:')}

      ${renderSubTitle('Ranking')}
      ${renderList(contexto.ranking_consumo_por_centro, { emptyText: 'Sem ranking de consumo por centro/setor.' })}
      <div class="relatorio-footnote">(Centro/Setor – Quantidade – % – Valor)</div>

      ${renderSubTitle('Centros/setores com desvio e recomendação:')}
      ${renderList(contexto.lista_centros_desvio_recomendacao, { emptyText: 'Sem desvios relevantes no período.' })}
      <div class="relatorio-footnote">(Centro – Diagnóstico – Recomendação)</div>
    `,
  )

  // 7) Vencidos / Vencendo / Excesso
  const sec7 = renderSection(
    '7. Vencidos / Vencendo / Excesso',
    `
      ${renderGrid([
        ['Vencidos', contexto.qtd_vencidos],
        ['Vencendo (até 30 dias)', contexto.qtd_vencendo],
        ['Excesso (estoque_atual > pressao_vida_util * 1,5)', contexto.qtd_excesso],
      ])}
    `,
  )

  // 8) Cobertura por trabalhador
  const sec8 = renderSection(
    '8. Cobertura por trabalhador',
    `
      ${renderGrid([
        ['Status', contexto.status_cobertura],
        ['Interpretação', contexto.interpretacao_cobertura],
      ])}

      ${renderParagraph('A cobertura média por trabalhador (por setor/centro) foi classificada como:')}

      ${renderList(contexto.ranking_cobertura_por_centro, { emptyText: 'Sem ranking de cobertura por centro/setor.' })}
      <div class="relatorio-footnote">(Centro/Setor – Trabalhadores – Cobertura (ciclos) – Status – Recomendação)</div>
    `,
  )

  // 9) Síntese de alertas
  const sec9 = renderSection(
    '9. Síntese de alertas',
    `
      ${renderGrid([
        ['Materiais abaixo do mínimo', contexto.qtd_abaixo_minimo],
        ['Riscos imediatos de ruptura', contexto.qtd_riscos_imediatos],
      ])}
    `,
  )

  // 10) Conclusão mensal
  const sec10 = renderSection(
    '10. Conclusão mensal',
    `
      ${renderParagraph(`A situação mensal do estoque é ${normalizeText(contexto.status_final)}.`)}
    `,
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
      .empresa__nome { font-size: 16px; font-weight: 700; }
      .empresa__documento, .empresa__endereco, .empresa__contato { font-size: 11px; }
      .titulo-principal { text-align: center; font-size: 15px; font-weight: 800; margin: 8px 0 14px; letter-spacing: 0.02em; }

      .relatorio-section { margin-bottom: 16px; }
      .relatorio-section h2 { margin: 0 0 8px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #1e293b; }

      .relatorio-subtitle { margin: 10px 0 6px; font-size: 12px; font-weight: 800; color: #0f172a; }
      .relatorio-paragraph { margin: 0 0 10px; font-size: 12px; color: #0f172a; line-height: 1.35; }

      .relatorio-grid { width: 100%; border-collapse: collapse; margin-top: 6px; }
      .relatorio-grid th, .relatorio-grid td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 12px; text-align: left; vertical-align: top; }
      .relatorio-grid th { width: 45%; background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; color: #334155; }

      .relatorio-list { margin: 6px 0 0 18px; padding: 0; font-size: 12px; }
      .relatorio-list li { margin-bottom: 4px; }
      .relatorio-bullets { margin: 6px 0 10px 18px; padding: 0; font-size: 12px; }
      .relatorio-bullets li { margin-bottom: 4px; }

      .relatorio-muted { font-size: 12px; color: #64748b; margin: 6px 0 0; }
      .relatorio-footnote { margin-top: 6px; font-size: 11px; color: #475569; }

      .relatorio-block { border: 1px solid #e2e8f0; background: #f8fafc; padding: 8px; margin-top: 8px; }
      .relatorio-block__title { font-size: 12px; font-weight: 800; margin-bottom: 6px; }
    </style>
  </head>
  <body>
    <div class="relatorio-document">
      ${renderEmpresa(empresa)}
      <div class="titulo-principal">${escapeHtml(titulo)}</div>

      ${renderSection('1. Identificação', identificacao)}
      ${renderSection('2. Resumo executivo', resumoExecutivo)}

      ${sec3}
      ${sec4}
      ${sec5}
      ${sec6}
      ${sec7}
      ${sec8}
      ${sec9}
      ${sec10}
    </div>
  </body>
</html>`
}
