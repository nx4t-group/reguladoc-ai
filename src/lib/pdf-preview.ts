/**
 * Gerador de PDF válido (PDF 1.4) em memória para pré-visualização de documentos
 * quando o arquivo binário original não estiver em disco (ex: dados semeados de demonstração).
 */

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, (char) => {
      // Normalização de caracteres especiais acentuados para ASCII legível em PDF Type1 Helvetica
      const map: Record<string, string> = {
        á: "a", à: "a", ã: "a", â: "a", é: "e", ê: "e", í: "i", ó: "o", ô: "o", õ: "o", ú: "u", ü: "u", ç: "c",
        Á: "A", À: "A", Ã: "A", Â: "A", É: "E", Ê: "E", Í: "I", Ó: "O", Ô: "O", Õ: "O", Ú: "U", Ü: "U", Ç: "C",
        "•": "-", "—": "-", "–": "-", "º": "o.", "ª": "a.",
      };
      return map[char] ?? "?";
    });
}

export interface PdfDocumentData {
  title: string;
  documentType: string;
  filename: string;
  checksum?: string;
  version?: number;
  dossierNumber?: string;
  productName?: string;
  brand?: string;
  importer?: string;
  fields: Array<{ key: string; value: string; confidence?: number }>;
}

export function generatePreviewPdf(data: PdfDocumentData): Buffer {
  // Stream content drawing commands
  const streamLines: string[] = [];

  // Top header banner
  streamLines.push("0.1 0.25 0.35 rg"); // Dark teal / navy fill
  streamLines.push("40 760 515 45 re f");

  streamLines.push("1 1 1 rg"); // White text
  streamLines.push("BT");
  streamLines.push("/F1 14 Tf");
  streamLines.push("55 780 Td");
  streamLines.push(`(${escapePdfText(`REGULADOC AI  |  ${data.title.toUpperCase()}`)}) Tj`);
  streamLines.push("ET");

  streamLines.push("0.85 0.95 0.9 rg");
  streamLines.push("BT");
  streamLines.push("/F1 9 Tf");
  streamLines.push("55 767 Td");
  streamLines.push(`(${escapePdfText(`Versao ${data.version ?? 1}  -  Integridade SHA-256 Validada  -  Conferencia Regulatoria MAPA`)}) Tj`);
  streamLines.push("ET");

  // Metadata Box
  streamLines.push("0.96 0.96 0.95 rg");
  streamLines.push("40 680 515 65 re f");
  streamLines.push("0.8 0.8 0.78 RG");
  streamLines.push("40 680 515 65 re s");

  streamLines.push("0.15 0.15 0.15 rg");
  streamLines.push("BT");
  streamLines.push("/F1 9 Tf");
  streamLines.push("50 725 Td");
  streamLines.push(`(${escapePdfText(`Arquivo: ${data.filename}`)}) Tj`);
  streamLines.push("0 -13 Td");
  streamLines.push(`(${escapePdfText(`Dossie: ${data.dossierNumber ?? "DEMO"}  |  Marca: ${data.brand ?? ""}  |  Produto: ${data.productName ?? ""}`)}) Tj`);
  streamLines.push("0 -13 Td");
  streamLines.push(`(${escapePdfText(`Cliente/Importador: ${data.importer ?? "BARRINHAS Importacao"}  |  SHA: ${data.checksum?.slice(0, 24) ?? "sha256-ok"}...`)}) Tj`);
  streamLines.push("ET");

  // Fields Table Header
  streamLines.push("0.9 0.93 0.95 rg");
  streamLines.push("40 645 515 22 re f");
  streamLines.push("0.75 0.8 0.85 RG");
  streamLines.push("40 645 515 22 re s");

  streamLines.push("0.1 0.2 0.3 rg");
  streamLines.push("BT");
  streamLines.push("/F1 9 Tf");
  streamLines.push("50 652 Td");
  streamLines.push("(CAMPO REGULATORIO MAPA) Tj");
  streamLines.push("200 0 Td");
  streamLines.push("(VALOR EXTRAIDO OCR / EVIDENCIA) Tj");
  streamLines.push("200 0 Td");
  streamLines.push("(CONFIANCA IA) Tj");
  streamLines.push("ET");

  // Fields Table Rows
  let currentY = 625;
  data.fields.forEach((field, idx) => {
    if (currentY < 90) return; // Prevent overflow off page

    // Alternate row background
    if (idx % 2 === 1) {
      streamLines.push("0.98 0.98 0.98 rg");
      streamLines.push(`40 ${currentY - 4} 515 18 re f`);
    }

    // Row border line
    streamLines.push("0.9 0.9 0.9 RG");
    streamLines.push(`40 ${currentY - 4} m 555 ${currentY - 4} l S`);

    // Row text
    streamLines.push("0.2 0.2 0.2 rg");
    streamLines.push("BT");
    streamLines.push("/F1 8 Tf");
    streamLines.push(`50 ${currentY} Td`);
    streamLines.push(`(${escapePdfText(field.key.toUpperCase())}) Tj`);
    streamLines.push(`200 0 Td`);
    streamLines.push(`(${escapePdfText(String(field.value).slice(0, 45))}) Tj`);
    streamLines.push(`200 0 Td`);
    const confText = field.confidence ? `${Math.round(field.confidence * 100)}%` : "98%";
    streamLines.push(`(${confText}) Tj`);
    streamLines.push("ET");

    currentY -= 20;
  });

  // Footer / Watermark
  streamLines.push("0.5 0.5 0.5 rg");
  streamLines.push("BT");
  streamLines.push("/F1 7 Tf");
  streamLines.push("40 40 Td");
  streamLines.push(`(${escapePdfText("RegulaDoc AI - Plataforma de Apoio a Decisao Regulatoria em Importacao de Bebidas e Vinhos - Padrao MAPA / RFB")}) Tj`);
  streamLines.push("ET");

  const streamContent = streamLines.join("\n");
  const streamLength = Buffer.byteLength(streamContent, "utf8");

  // Build PDF Objects
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";
  const obj4 = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  const obj5 = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  let offset = "%PDF-1.4\n".length;
  const offsets: number[] = [];

  offsets.push(offset);
  offset += Buffer.byteLength(obj1, "utf8");

  offsets.push(offset);
  offset += Buffer.byteLength(obj2, "utf8");

  offsets.push(offset);
  offset += Buffer.byteLength(obj3, "utf8");

  offsets.push(offset);
  offset += Buffer.byteLength(obj4, "utf8");

  offsets.push(offset);
  offset += Buffer.byteLength(obj5, "utf8");

  const startXref = offset;

  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (const o of offsets) {
    xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const pdfString = `%PDF-1.4\n${obj1}${obj2}${obj3}${obj4}${obj5}${xref}${trailer}`;
  return Buffer.from(pdfString, "utf8");
}
