const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR')

function escapeHtml(value) {
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

function formatDate(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return DATE_FORMAT.format(date)
}

function renderEntregaRow(entrega) {
  return `
      <tr>
        <td>${formatDate(entrega.dataEntrega)}</td>
        <td class="text-center">${entrega.quantidade ?? ''}</td>
        <td>${escapeHtml(entrega.descricao)}</td>
        <td class="text-center">${escapeHtml(entrega.numeroCa || '')}</td>
        <td class="text-center">${escapeHtml(entrega.usuarioResponsavel || '')}</td>
        <td>${formatDate(entrega.dataTroca)}</td>
        <td>${escapeHtml(entrega.motivo || '')}</td>
        <td class="assinatura-coluna">${escapeHtml(entrega.assinatura || '')}</td>
      </tr>
    `
}

function renderEmptyRow() {
  return `
      <tr>
        <td>&nbsp;</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `
}

export function buildEpiTermHtml(context = {}) {
  const {
    colaborador = {},
    entregas = [],
    totais = {},
    empresa = {},
  } = context

  const linhasPreenchidas = entregas.map(renderEntregaRow).join('')
  const linhasVaziasQuantidade = Math.max(0, 10 - entregas.length)
  const linhasVazias = Array.from({ length: linhasVaziasQuantidade }, renderEmptyRow).join('')

  const assinaturaColaborador = escapeHtml(colaborador.nome || '')
  const logoPrincipal = empresa.logoUrl
    ? `<div class="empresa__logo"><img src="${escapeHtml(empresa.logoUrl)}" alt="Logo principal" /></div>`
    : ''
  const logoSecundario = empresa.logoSecundarioUrl
    ? `<div class="empresa__logo empresa__logo--secundaria"><img src="${escapeHtml(
        empresa.logoSecundarioUrl,
      )}" alt="Logo secundária" /></div>`
    : ''
  const cabecalhoEmpresa = `
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

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Termo de responsabilidade de uso de EPI</title>
    <style>
      * {
        box-sizing: border-box;
      }
      .termo-epi-document {
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 12px;
        margin: 24px;
        color: #0f172a;
      }
      h1, h2, h3 {
        margin: 0;
      }
      .empresa {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      .empresa__logo {
        max-width: 200px;
      }
      .empresa__logo img {
        max-width: 200%;
        max-height: 160px;
        display: block;
      }
      .empresa__logo.empresa__logo--secundaria {
        text-align: right;
      }
      .empresa__identidade {
        max-width: 60%;
      }
      .empresa__nome {
        font-size: 16px;
        font-weight: 600;
      }
      .empresa__documento,
      .empresa__endereco,
      .empresa__contato {
        font-size: 11px;
      }
      .titulo-principal {
        text-align: center;
        font-size: 16px;
        font-weight: 700;
        margin: 8px 0 16px;
        padding: 8px;
        background: #dbeafe;
        border: 1px solid #1d4ed8;
      }
      .quadro-colaborador {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
      }
      .quadro-colaborador th,
      .quadro-colaborador td {
        border: 1px solid #1e293b;
        padding: 6px 8px;
        font-size: 11px;
      }
      .quadro-colaborador th {
        background: #e2e8f0;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
      }
      .termo-texto {
        font-size: 11px;
        line-height: 1.5;
        text-align: justify;
        margin-bottom: 16px;
      }
      .assinaturas {
        display: flex;
        justify-content: space-between;
        margin: 24px 0;
        gap: 32px;
      }
      .assinaturas__area {
        flex: 1;
        text-align: center;
      }
      .assinaturas__linha {
        border-bottom: 1px solid #1e293b;
        margin: 0 auto 4px;
        height: 40px;
        width: 50%;
      }
      table.entregas {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      table.entregas th,
      table.entregas td {
        border: 1px solid #1e293b;
        padding: 4px 6px;
      }
      table.entregas th {
        background: #e2e8f0;
        text-transform: uppercase;
        font-size: 10px;
      }
      .assinatura-coluna {
        min-width: 140px;
        text-align: center;
      }
      .text-center {
        text-align: center;
      }
      ol {
        margin: 0 0 16px 18px;
        padding: 0;
        list-style: decimal;
      }
    </style>
  </head>
  <body class="termo-epi-document">
    ${cabecalhoEmpresa}
    <div class="titulo-principal">Termo de responsabilidade de uso do equipamento de proteção individual</div>
    <table class="quadro-colaborador">
      <tr>
        <th>Nome do colaborador</th>
        <th>Unidade</th>
        <th>Entrega</th>
        <th>Admissão</th>
        <th>Matr.</th>
        <th>Função</th>
      </tr>
      <tr>
        <td>${escapeHtml(colaborador.nome || '')}</td>
        <td>${escapeHtml(colaborador.unidade || colaborador.centroServico || '')}</td>
        <td>${formatDate(totais.ultimaEntrega)}</td>
        <td>${formatDate(colaborador.dataAdmissao)}</td>
        <td class="text-center">${escapeHtml(colaborador.matricula || '')}</td>
        <td>${escapeHtml(colaborador.cargo || '')}</td>
      </tr>
    </table>
    <div class="termo-texto">
      <p>
        Declaro para fins de direito, que estou Recebendo da Fundação Educacional Dom Andre Arco Verde os EPIs - Equipamentos de Proteção Individual, aqui relacionados, 
        e estes foram fornecidos gratuitamente, em perfeito estado de conservação e funcionamento e são destinados exclusivamente a minha proteção contra Acidentes e/ou doenças do trabalho, nos termos do Art. 166, Art.191 da CLT, Decreto Lei 5452/43 e com a NR - 6  Portaria 3.214/78.
      </p>

      <p>
        Declaro ainda estar ciente que, de acordo com Artigo 158 parágrafo único alínea B da CLT e item 6.3 da mesma portaria, devo:
      </p>

      <ol>
        <li>Usar os equipamentos de proteção individual que me forem entregues de forma adequada, sempre que estiver em local onde a utilização dos mesmos se fizer obrigatória;</li>
        <li>Zelar pela guarda e conservação dos EPIs que me forem entregues, não entregando a outros colaboradores;</li>
        <li>Comunicar imediatamente à empresa em caso de quebra, desgaste, perda ou extravio do EPI, para que o mesmo seja reposto de imediato;</li>
        <li>Comunicar à área de Segurança do Trabalho, através do Coordenador, Líder e/ou Supervisor imediato, qualquer alteração no EPI que o torne parcial ou totalmente danificado. Em caso de inutilização por uso inadequado ou extravio por minha culpa, ou pela não devolução dos mesmos no ato da rescisão do contrato de trabalho, autorizo o desconto do valor de custo do referido material em meus salários/proventos;</li>
        <li>Atesto que recebi da área de SESMT treinamento sobre a utilização correta e conservação dos EPIs que me foram entregues.</li>
      </ol>

    </div>
    <div class="assinaturas">
      <div class="assinaturas__area">
        <div class="assinaturas__linha"></div>
        <div>${assinaturaColaborador}</div>
        <div>Colaborador</div>
      </div>
      <div class="assinaturas__area">
        <div class="assinaturas__linha"></div>
        <div>Responsável pela entrega</div>
      </div>
    </div>
    <h3>Ficha de controle de entrega de EPI</h3>
    <table class="entregas">
      <thead>
        <tr>
          <th>Data</th>
          <th>Qtd</th>
          <th>Descrição do material</th>
          <th>Nº CA</th>
          <th>Responsável</th>
          <th>Devolução prevista</th>
          <th>Motivo/observação</th>
          <th class="assinatura-coluna">Assinatura do colaborador</th>
        </tr>
      </thead>
      <tbody>
        ${linhasPreenchidas || ''}
        ${linhasVazias}
      </tbody>
    </table>
  </body>
</html>`
}
