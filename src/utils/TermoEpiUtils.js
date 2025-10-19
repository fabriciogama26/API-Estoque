import { dataClient } from "../services/dataClient.js";


export async function downloadTermoEpiPdf({ params = {} } = {}) {
  const blob = await dataClient.documentos.termoEpiPdf(params);
  const identificador = params.matricula || params.nome || "colaborador";
  const fileName = `termo-epi-${identificador}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}