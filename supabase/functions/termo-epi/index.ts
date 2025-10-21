import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

type Maybe<T> = T | null | undefined;

interface PessoaRecord {
  id: string;
  nome: string | null;
  matricula: string | null;
  cargo: string | null;
  centroServico: string | null;
  unidade: string | null;
  dataAdmissao: string | null;
}

interface MaterialRecord {
  nome: string | null;
  fabricante: string | null;
  ca: string | null;
  numeroEspecifico: string | null;
  numeroCalcado: string | null;
  numeroVestimenta: string | null;
}

interface SaidaRecord {
  id: string;
  pessoaId: string;
  materialId: string | null;
  quantidade: number | null;
  centroCusto: string | null;
  centroServico: string | null;
  dataEntrega: string | null;
  dataTroca: string | null;
  status: string | null;
  usuarioResponsavel: string | null;
  material: MaterialRecord | null;
}

interface Entrega {
  ordem: number;
  dataEntrega: string | null;
  quantidade: number;
  descricao: string;
  numeroCa: string;
  usuarioResponsavel: string;
  dataTroca: string | null;
  motivo: string;
}

interface TermoContext {
  colaborador: {
    nome: string;
    matricula: string;
    cargo: string;
    centroServico: string;
    unidade: string;
    dataAdmissao: string | null;
  };
  entregas: Entrega[];
  totais: {
    quantidadeEntregas: number;
    totalItensEntregues: number;
    ultimaEntrega: string | null;
  };
  empresa: EmpresaInfo;
}

interface EmpresaInfo {
  nome: string;
  documento: string;
  endereco: string;
  contato: string;
  logoUrl: string;
  logoSecundarioUrl: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const params = await resolveParams(req);
    if (!params.matricula && !params.nome) {
      return jsonError("Informe a matricula ou o nome do colaborador.", 400);
    }

    const pessoa = await buscarPessoa(supabase, params);
    if (!pessoa) {
      return jsonError("Colaborador nao encontrado.", 404);
    }

    const saidas = await buscarSaidas(supabase, pessoa.id);
    if (!saidas.length) {
      return jsonError("Nenhuma saida registrada para o colaborador informado.", 404);
    }

    const contexto = montarContextoTermo(pessoa, saidas, carregarEmpresa());
    const pdfBytes = await gerarPdf(contexto);

    const headers = new Headers({
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="termo-epi.pdf"',
      "Cache-Control": "no-store",
      "Content-Length": String(pdfBytes.byteLength),
    });
    return new Response(pdfBytes, { status: 200, headers });
  } catch (error) {
    console.error("Erro na funcao termo-epi:", error);
    return jsonError("Falha ao gerar o PDF do termo.", 500);
  }
});

async function resolveParams(req: Request): Promise<{ matricula?: string; nome?: string }> {
  const url = new URL(req.url);
  const matricula = trim(url.searchParams.get("matricula"));
  const nome = trim(url.searchParams.get("nome"));

  if (matricula || nome || req.method === "GET") {
    return { matricula, nome };
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      return {
        matricula: trim(body?.matricula),
        nome: trim(body?.nome),
      };
    } catch {
      return { matricula: undefined, nome: undefined };
    }
  }

  return { matricula: undefined, nome: undefined };
}

async function buscarPessoa(
  client: SupabaseClient,
  params: { matricula?: string; nome?: string },
): Promise<PessoaRecord | null> {
  if (params.matricula) {
    const { data, error } = await client
      .from("pessoas")
      .select("*")
      .eq("matricula", params.matricula)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      return mapPessoa(data);
    }
  }

  if (params.nome) {
    const like = `%${params.nome.replace(/\s+/g, "%")}%`;
    const { data, error } = await client
      .from("pessoas")
      .select("*")
      .ilike("nome", like)
      .order("nome", { ascending: true })
      .limit(1);
    if (error) {
      throw error;
    }
    const pessoa = data?.[0];
    if (pessoa) {
      return mapPessoa(pessoa);
    }
  }

  return null;
}

async function buscarSaidas(client: SupabaseClient, pessoaId: string): Promise<SaidaRecord[]> {
  const { data, error } = await client
    .from("saidas")
    .select(
      `
      id,
      pessoaId,
      materialId,
      quantidade,
      centroCusto,
      centroServico,
      dataEntrega,
      dataTroca,
      status,
      usuarioResponsavel,
      material:materialId(
        nome,
        fabricante,
        ca,
        numeroEspecifico,
        numeroCalcado,
        numeroVestimenta
      )
    `,
    )
    .eq("pessoaId", pessoaId)
    .order("dataEntrega", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapSaidaRecord);
}

function montarContextoTermo(
  pessoa: PessoaRecord,
  saidas: SaidaRecord[],
  empresa: EmpresaInfo,
): TermoContext {
  const entregasOrdenadas = [...saidas].sort((a, b) => {
    const aTime = toTime(a.dataEntrega);
    const bTime = toTime(b.dataEntrega);
    return aTime - bTime;
  });

  const entregas = entregasOrdenadas.map((saida, index) => ({
    ordem: index + 1,
    dataEntrega: saida.dataEntrega,
    quantidade: Number(saida.quantidade ?? 0),
    descricao: buildDescricaoMaterial(saida.material),
    numeroCa: trim(saida.material?.ca) ?? "",
    usuarioResponsavel: trim(saida.usuarioResponsavel) ?? "",
    dataTroca: saida.dataTroca,
    motivo: trim(saida.status) ?? "",
  }));

  const totalItensEntregues = entregas.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0);
  const ultimaEntrega = entregasOrdenadas.length
    ? entregasOrdenadas[entregasOrdenadas.length - 1].dataEntrega ?? null
    : null;

  return {
    colaborador: {
      nome: pessoa.nome ?? "",
      matricula: pessoa.matricula ?? "",
      cargo: pessoa.cargo ?? "",
      centroServico: pessoa.centroServico ?? "",
      unidade: pessoa.unidade ?? pessoa.centroServico ?? "",
      dataAdmissao: pessoa.dataAdmissao ?? null,
    },
    entregas,
    totais: {
      quantidadeEntregas: entregas.length,
      totalItensEntregues,
      ultimaEntrega,
    },
    empresa,
  };
}

async function gerarPdf(contexto: TermoContext): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdfDoc.addPage(pageSize);
  const margin = 40;
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let cursorY = page.getHeight() - margin;

  const primaryLogo = await tentarIncorporarImagem(pdfDoc, contexto.empresa.logoUrl);
  const secondaryLogo = await tentarIncorporarImagem(pdfDoc, contexto.empresa.logoSecundarioUrl);

  if (primaryLogo) {
    const width = Math.min(120, primaryLogo.width);
    const scale = width / primaryLogo.width;
    const height = primaryLogo.height * scale;
    page.drawImage(primaryLogo, {
      x: margin,
      y: cursorY - height,
      width,
      height,
    });
    cursorY -= height + 10;
  }

  if (secondaryLogo) {
    const width = Math.min(100, secondaryLogo.width);
    const scale = width / secondaryLogo.width;
    const height = secondaryLogo.height * scale;
    page.drawImage(secondaryLogo, {
      x: page.getWidth() - margin - width,
      y: page.getHeight() - margin - height,
      width,
      height,
    });
  }

  cursorY = drawParagraph({
    page,
    cursorY,
    text: contexto.empresa.nome || "Termo de EPI",
    font: boldFont,
    fontSize: 16,
    margin,
    maxWidth: page.getWidth() - margin * 2,
    color: rgb(0.1, 0.15, 0.25),
  }) - 4;

  const empresaInfo = [
    contexto.empresa.documento,
    contexto.empresa.endereco,
    contexto.empresa.contato,
  ].filter(Boolean).join(" | ");

  if (empresaInfo) {
    cursorY = drawParagraph({
      page,
      cursorY,
      text: empresaInfo,
      font: regularFont,
      fontSize: 10,
      margin,
      maxWidth: page.getWidth() - margin * 2,
      color: rgb(0.3, 0.35, 0.4),
    });
  }

  cursorY -= 10;

  cursorY = drawParagraph({
    page,
    cursorY,
    text: "Termo de responsabilidade pelo uso de Equipamento de Protecao Individual (EPI)",
    font: boldFont,
    fontSize: 14,
    margin,
    maxWidth: page.getWidth() - margin * 2,
    color: rgb(0, 0, 0),
  }) - 8;

  ({ page, cursorY } = ensureSpace(pdfDoc, page, cursorY, margin, 90));
  cursorY = drawSectionLabel(page, cursorY, margin, "Dados do colaborador", boldFont);
  cursorY = drawKeyValueRow(page, cursorY, margin, [
    ["Nome", contexto.colaborador.nome],
    ["Matricula", contexto.colaborador.matricula],
  ], regularFont, boldFont);
  cursorY = drawKeyValueRow(page, cursorY, margin, [
    ["Funcao", contexto.colaborador.cargo],
    ["Unidade", contexto.colaborador.unidade],
  ], regularFont, boldFont);
  cursorY = drawKeyValueRow(page, cursorY, margin, [
    ["Centro de servico", contexto.colaborador.centroServico],
    ["Data de admissao", formatDate(contexto.colaborador.dataAdmissao)],
  ], regularFont, boldFont);

  cursorY -= 6;
  ({ page, cursorY } = ensureSpace(pdfDoc, page, cursorY, margin, 160));

  cursorY = drawSectionLabel(page, cursorY, margin, "Declaracao do colaborador", boldFont);

  const paragrafos = [
    "Declaro que recebi, gratuitamente, os equipamentos de protecao individual relacionados neste documento, em perfeitas condicoes de uso, destinados exclusivamente a minha protecao contra acidentes e/ou doencas ocupacionais, em conformidade com o Art. 166 e Art. 191 da CLT e a NR-6.",
    "Comprometo-me a utilizar os EPIs sempre que necessario, zelar pela sua guarda e conservacao, comunicar de imediato qualquer dano, extravio ou perda, bem como solicitar a substituicao quando o equipamento se tornar parcial ou totalmente inutilizado.",
    "Estou ciente de que o uso inadequado, a nao devolucao quando solicitado ou o extravio por minha culpa podem gerar descontos correspondentes ao valor do equipamento em minha remuneracao.",
  ];

  for (const texto of paragrafos) {
    ({ page, cursorY } = ensureSpace(pdfDoc, page, cursorY, margin, 60));
    cursorY = drawParagraph({
      page,
      cursorY,
      text: texto,
      font: regularFont,
      fontSize: 11,
      margin,
      maxWidth: page.getWidth() - margin * 2,
      color: rgb(0, 0, 0),
    }) - 6;
  }

  ({ page, cursorY } = ensureSpace(pdfDoc, page, cursorY, margin, 100));

  cursorY = drawSectionLabel(page, cursorY, margin, "Resumo das entregas", boldFont);
  cursorY = drawKeyValueRow(page, cursorY, margin, [
    ["Quantidade de registros", String(contexto.totais.quantidadeEntregas)],
    ["Total de itens", String(contexto.totais.totalItensEntregues)],
  ], regularFont, boldFont);
  cursorY = drawKeyValueRow(page, cursorY, margin, [
    ["Ultima entrega", formatDate(contexto.totais.ultimaEntrega)],
  ], regularFont, boldFont);

  cursorY -= 2;

  ({ page, cursorY } = ensureSpace(pdfDoc, page, cursorY, margin, 220));
  cursorY = drawSectionLabel(page, cursorY, margin, "Historico de entregas (max. 10 registros)", boldFont);

  const entregasCompletas = preencherEntregas(contexto.entregas, 10);
  for (const entrega of entregasCompletas) {
    ({ page, cursorY } = ensureSpace(pdfDoc, page, cursorY, margin, 70));
    cursorY = drawEntregaBloco(page, cursorY, margin, entrega, regularFont, boldFont);
  }

  ({ page, cursorY } = ensureSpace(pdfDoc, page, cursorY, margin, 100));

  cursorY = drawSectionLabel(page, cursorY, margin, "Assinaturas", boldFont);
  cursorY = drawSignatureLine(page, cursorY, margin, "Colaborador", regularFont, boldFont, contexto.colaborador.nome);
  cursorY -= 20;
  cursorY = drawSignatureLine(page, cursorY, margin, "Responsavel pela entrega", regularFont, boldFont);

  return pdfDoc.save();
}

async function tentarIncorporarImagem(pdfDoc: PDFDocument, url: Maybe<string>) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    const bytes = await response.arrayBuffer();
    if (contentType.includes("png")) {
      return await pdfDoc.embedPng(bytes);
    }
    return await pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function drawSectionLabel(
  page: ReturnType<PDFDocument["addPage"]>,
  cursorY: number,
  margin: number,
  label: string,
  font: any,
) {
  page.drawText(label, {
    x: margin,
    y: cursorY,
    size: 12,
    font,
    color: rgb(0.1, 0.15, 0.25),
  });
  return cursorY - 18;
}

function drawKeyValueRow(
  page: ReturnType<PDFDocument["addPage"]>,
  cursorY: number,
  margin: number,
  pairs: Array<[string, string]>,
  regularFont: any,
  boldFont: any,
) {
  const lineHeight = 14;
  let currentY = cursorY;
  let x = margin;
  const maxWidth = page.getWidth() - margin * 2;
  const chunkWidth = maxWidth / Math.max(1, pairs.length);

  for (const [label, value] of pairs) {
    const labelText = `${label}:`;
    page.drawText(labelText, {
      x,
      y: currentY,
      size: 11,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    const labelWidth = boldFont.widthOfTextAtSize(labelText, 11) + 4;
    page.drawText(value || "-", {
      x: x + labelWidth,
      y: currentY,
      size: 11,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    x += chunkWidth;
  }

  return currentY - lineHeight;
}

function drawEntregaBloco(
  page: ReturnType<PDFDocument["addPage"]>,
  cursorY: number,
  margin: number,
  entrega: Entrega,
  regularFont: any,
  boldFont: any,
) {
  const boxHeight = 66;
  page.drawRectangle({
    x: margin,
    y: cursorY - boxHeight,
    width: page.getWidth() - margin * 2,
    height: boxHeight,
    borderColor: rgb(0.75, 0.78, 0.82),
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });

  let innerY = cursorY - 16;
  const innerX = margin + 10;
  const innerWidth = page.getWidth() - margin * 2 - 20;

  page.drawText(`Entrega ${entrega.ordem}`, {
    x: innerX,
    y: innerY,
    size: 11,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  innerY -= 16;

  const linha1 = [
    `Data: ${formatDate(entrega.dataEntrega) || "-"}`,
    `Quantidade: ${entrega.quantidade || "-"}`,
    `CA: ${entrega.numeroCa || "-"}`,
  ].join("   ");

  page.drawText(linha1, {
    x: innerX,
    y: innerY,
    size: 10,
    font: regularFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  innerY -= 14;

  innerY = drawParagraph({
    page,
    cursorY: innerY,
    text: `Descricao: ${entrega.descricao || "-"}`,
    font: regularFont,
    fontSize: 10,
    margin: innerX,
    maxWidth: innerWidth,
    color: rgb(0.1, 0.1, 0.1),
  }) - 2;

  const linha3 = [
    `Responsavel: ${entrega.usuarioResponsavel || "-"}`,
    `Devolucao prevista: ${formatDate(entrega.dataTroca) || "-"}`,
  ].join("   ");

  innerY -= 2;

  page.drawText(linha3, {
    x: innerX,
    y: innerY,
    size: 10,
    font: regularFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  innerY -= 14;

  page.drawText(`Motivo/observacao: ${entrega.motivo || "-"}`, {
    x: innerX,
    y: innerY,
    size: 10,
    font: regularFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  return cursorY - boxHeight - 12;
}

function drawSignatureLine(
  page: ReturnType<PDFDocument["addPage"]>,
  cursorY: number,
  margin: number,
  label: string,
  regularFont: any,
  boldFont: any,
  prefill?: string,
) {
  const lineWidth = 240;
  const x = margin;
  const lineY = cursorY - 6;

  page.drawLine({
    start: { x, y: lineY },
    end: { x: x + lineWidth, y: lineY },
    thickness: 0.6,
    color: rgb(0.3, 0.3, 0.3),
  });

  if (prefill) {
    page.drawText(prefill, {
      x: x + 4,
      y: lineY + 2,
      size: 10,
      font: regularFont,
      color: rgb(0.15, 0.15, 0.15),
    });
  }

  page.drawText(label, {
    x,
    y: lineY - 14,
    size: 10,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  return lineY - 22;
}

function drawParagraph(options: {
  page: ReturnType<PDFDocument["addPage"]>;
  cursorY: number;
  text: string;
  font: any;
  fontSize: number;
  margin: number;
  maxWidth: number;
  color: ReturnType<typeof rgb>;
}) {
  const { page, cursorY, text, font, fontSize, margin, maxWidth, color } = options;
  const lines = wrapText(text, font, fontSize, maxWidth);
  let currentY = cursorY;
  for (const line of lines) {
    page.drawText(line, {
      x: margin,
      y: currentY,
      size: fontSize,
      font,
      color,
    });
    currentY -= fontSize * 1.35;
  }
  return currentY;
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/g);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width <= maxWidth) {
      current = testLine;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function ensureSpace(
  pdfDoc: PDFDocument,
  currentPage: ReturnType<PDFDocument["addPage"]>,
  cursorY: number,
  margin: number,
  spaceNeeded: number,
) {
  if (cursorY - spaceNeeded > margin) {
    return { page: currentPage, cursorY };
  }
  const newPage = pdfDoc.addPage(currentPage.getSize());
  return { page: newPage, cursorY: newPage.getHeight() - margin };
}

function preencherEntregas(entregas: Entrega[], totalDesejado: number): Entrega[] {
  if (entregas.length >= totalDesejado) {
    return entregas.slice(-totalDesejado).map((item, index) => ({
      ...item,
      ordem: index + 1,
    }));
  }

  const preenchidas = [...entregas];
  for (let i = entregas.length; i < totalDesejado; i++) {
    preenchidas.push({
      ordem: i + 1,
      dataEntrega: null,
      quantidade: 0,
      descricao: "",
      numeroCa: "",
      usuarioResponsavel: "",
      dataTroca: null,
      motivo: "",
    });
  }
  return preenchidas;
}

function carregarEmpresa(): EmpresaInfo {
  return {
    nome: Deno.env.get("TERMO_EPI_EMPRESA_NOME") ?? "",
    documento: Deno.env.get("TERMO_EPI_EMPRESA_DOCUMENTO") ?? "",
    endereco: Deno.env.get("TERMO_EPI_EMPRESA_ENDERECO") ?? "",
    contato: Deno.env.get("TERMO_EPI_EMPRESA_CONTATO") ?? "",
    logoUrl: Deno.env.get("TERMO_EPI_EMPRESA_LOGO_URL") ?? "",
    logoSecundarioUrl: Deno.env.get("TERMO_EPI_EMPRESA_LOGO_SECUNDARIO_URL") ?? "",
  };
}

function mapPessoa(record: Record<string, unknown>): PessoaRecord {
  return {
    id: String(record.id ?? ""),
    nome: safeString(record.nome),
    matricula: safeString(record.matricula),
    cargo: safeString(record.cargo),
    centroServico: safeString(record.centroServico ?? record.local),
    unidade: safeString(record.unidade ?? record.centroServico ?? record.local),
    dataAdmissao: safeString(record.dataAdmissao),
  };
}

function mapSaidaRecord(record: Record<string, unknown>): SaidaRecord {
  return {
    id: String(record.id ?? ""),
    pessoaId: String(record.pessoaId ?? ""),
    materialId: record.materialId === null || record.materialId === undefined
      ? null
      : String(record.materialId),
    quantidade: Number(record.quantidade ?? 0),
    centroCusto: safeString(record.centroCusto),
    centroServico: safeString(record.centroServico),
    dataEntrega: safeString(record.dataEntrega),
    dataTroca: safeString(record.dataTroca),
    status: safeString(record.status),
    usuarioResponsavel: safeString(record.usuarioResponsavel),
    material: record.material ? mapMaterial(record.material as Record<string, unknown>) : null,
  };
}

function mapMaterial(record: Record<string, unknown>): MaterialRecord {
  return {
    nome: safeString(record.nome),
    fabricante: safeString(record.fabricante),
    ca: safeString(record.ca),
    numeroEspecifico: safeString(record.numeroEspecifico),
    numeroCalcado: safeString(record.numeroCalcado),
    numeroVestimenta: safeString(record.numeroVestimenta),
  };
}

function safeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function trim(value: Maybe<string>): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toTime(value: Maybe<string>): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value: Maybe<string>): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function buildDescricaoMaterial(material: Maybe<MaterialRecord>): string {
  if (!material) return "";
  const partes = [
    material.nome ?? "",
    material.fabricante ?? "",
    material.numeroEspecifico ?? material.numeroCalcado ?? material.numeroVestimenta ?? "",
  ].filter(Boolean);
  return partes.join(" ");
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
