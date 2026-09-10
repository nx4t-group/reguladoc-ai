import type { DocumentType } from "@/lib/constants";
import { normalizeText } from "../rules/calculations";

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  detectedBatch?: string;
  detectedBrand?: string;
  suggestedItemId?: string;
}

/**
 * Classificador documental heurístico de alta performance.
 * Analisa o nome do arquivo, metadados e trechos do texto inicial para identificar
 * automaticamente o tipo documental com confiança calibrada, sem forçar o usuário a escolher antes.
 */
export function classifyDocument(filename: string, textSample?: string): ClassificationResult {
  const normName = normalizeText(filename);
  const normText = textSample ? normalizeText(textSample) : "";
  const combined = `${normName} ${normText}`;

  // 1. Anexo IX (Certificado Oficial MAPA para importação de bebidas)
  if (
    combined.includes("ANEXO IX") ||
    combined.includes("ANEXO 9") ||
    combined.includes("MODELO IX") ||
    (combined.includes("MAPA") && combined.includes("IMPORTACAO"))
  ) {
    return { documentType: "anexo_ix", confidence: 0.95 };
  }

  // 2. Laudo de Análise (Laboratório / Boletim de Análise Físico-Química)
  if (
    combined.includes("LAUDO") ||
    combined.includes("ANALISE") ||
    combined.includes("CERTIFICATE OF ANALYSIS") ||
    combined.includes("BULLETIN D ANALYSE") ||
    combined.includes("TEOR ALCOOLICO") ||
    combined.includes("ACIDEZ TOTAL")
  ) {
    return { documentType: "laudo_analise", confidence: 0.92 };
  }

  // 3. Certificado de Origem
  if (
    combined.includes("CERTIFICADO DE ORIGEM") ||
    combined.includes("CERTIFICATE OF ORIGIN") ||
    combined.includes("ORIGEM") ||
    combined.includes("CHAMBER OF COMMERCE")
  ) {
    return { documentType: "certificado_origem", confidence: 0.94 };
  }

  // 4. CII (Certificado de Inspeção de Importação)
  if (
    combined.includes("CII") ||
    combined.includes("CERTIFICADO DE INSPECAO") ||
    combined.includes("INSPECAO DE IMPORTACAO")
  ) {
    return { documentType: "cii", confidence: 0.96 };
  }

  // 5. Invoice (Fatura Comercial)
  if (
    combined.includes("INVOICE") ||
    combined.includes("COMMERCIAL INVOICE") ||
    combined.includes("FATURA")
  ) {
    return { documentType: "invoice", confidence: 0.93 };
  }

  // 6. Packing List (Romaneio de Carga)
  if (
    combined.includes("PACKING LIST") ||
    combined.includes("PACKING") ||
    combined.includes("ROMANEIO")
  ) {
    return { documentType: "packing_list", confidence: 0.95 };
  }

  // 7. Rótulo (Label / Contra-rótulo)
  if (
    combined.includes("ROTULO") ||
    combined.includes("CONTRA ROTULO") ||
    combined.includes("LABEL") ||
    combined.includes("ARTE")
  ) {
    return { documentType: "rotulo", confidence: 0.9 };
  }

  // Fallback seguro: "outro" com confiança neutra
  return { documentType: "outro", confidence: 0.5 };
}

/**
 * Sugere associação a um item do dossiê com base em lote, marca ou produto.
 * Se a confiança for insuficiente (< 0.7), o sistema deve solicitar confirmação do analista.
 */
export function matchDocumentToItem(
  extractedFields: Record<string, string | undefined>,
  items: Array<{ id: string; batchNumber?: string | null; brand: string; productName: string }>
): { matchedItemId?: string; confidence: number; reason?: string } {
  if (items.length === 0) return { confidence: 0 };
  if (items.length === 1) {
    return { matchedItemId: items[0].id, confidence: 0.95, reason: "Único item do dossiê" };
  }

  const docBatch = normalizeText(extractedFields.numero_lote);
  const docBrand = normalizeText(extractedFields.marca);

  // 1. Coincidência exata de lote
  if (docBatch) {
    const itemByBatch = items.find((it) => it.batchNumber && normalizeText(it.batchNumber) === docBatch);
    if (itemByBatch) {
      return { matchedItemId: itemByBatch.id, confidence: 0.98, reason: `Coincidência exata do lote "${docBatch}"` };
    }
  }

  // 2. Coincidência de marca
  if (docBrand) {
    const itemByBrand = items.find((it) => normalizeText(it.brand) === docBrand);
    if (itemByBrand) {
      return { matchedItemId: itemByBrand.id, confidence: 0.85, reason: `Coincidência da marca "${docBrand}"` };
    }
  }

  // Confiança baixa: requer confirmação humana
  return { confidence: 0.3, reason: "Identificadores insuficientes para associação automática" };
}
