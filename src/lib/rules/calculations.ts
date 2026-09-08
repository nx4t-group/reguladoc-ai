import type { DocumentType } from "@/lib/constants";

/** Um documento do dossiê com seus campos extraídos já resolvidos para string. */
export interface DocumentFieldSet {
  documentType: DocumentType;
  documentId?: string;
  fields: Record<string, string | undefined>;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * volume_total = número_de_embalagens × unidades_por_embalagem × capacidade_unitária
 * (RULE-008). Ex.: 800 caixas × 6 garrafas × 0,75 L = 3.600 L.
 */
export function calculateTotalVolume(
  packages: number,
  unitsPerPackage: number,
  unitCapacityLiters: number,
): number {
  if (
    !Number.isFinite(packages) ||
    !Number.isFinite(unitsPerPackage) ||
    !Number.isFinite(unitCapacityLiters)
  ) {
    return 0;
  }
  return round2(packages * unitsPerPackage * unitCapacityLiters);
}

/**
 * Normaliza texto para comparação: caixa alta, sem acentos, sem pontuação não
 * essencial, espaços colapsados e aparados.
 */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Igualdade de dois valores após normalização de texto. */
export function compareNormalized(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  return na === nb;
}

export type BrandComparisonKind = "exact" | "equivalent_with_note" | "divergent" | "insufficient_data";

export interface BrandComparisonResult {
  kind: BrandComparisonKind;
  note?: string;
}

/**
 * Compara duas marcas tratando a safra como possível complemento equivalente.
 * Ex.: "Tapada do Fidalgo 2025" vs "Tapada do Fidalgo" com vintage "2025"
 * resulta em `equivalent_with_note`, não em divergência (RULE-004).
 */
export function compareBrand(
  a: string | null | undefined,
  b: string | null | undefined,
  context?: { vintage?: string | null },
): BrandComparisonResult {
  const na = normalizeText(a);
  const nb = normalizeText(b);

  if (!na || !nb) return { kind: "insufficient_data" };
  if (na === nb) return { kind: "exact" };

  const vintage = normalizeText(context?.vintage ?? undefined);
  if (vintage) {
    const withVintage = (base: string) => `${base} ${vintage}`.trim();
    if (withVintage(na) === nb || withVintage(nb) === na) {
      return {
        kind: "equivalent_with_note",
        note: `A diferença pode ser explicada pela safra ${context?.vintage} estar registrada como parte da descrição do produto em um dos documentos.`,
      };
    }
  }

  // Qualquer outra diferença — incluindo um nome de marca ser substring do
  // outro (ex.: "Quinta das Carvalhas" vs "Carvalhas") — é tratada como
  // divergência real, não equivalência: só a safra é uma exceção conhecida.
  return { kind: "divergent" };
}

export interface BoxBottleMistakeResult {
  detected: boolean;
  correctTotalLiters: number;
  mistakenAssumedTotalLiters: number;
}

/**
 * Detecta o erro clássico de tratar número de caixas como número de garrafas
 * (RULE-009). Ex.: 900 caixas de 6 garrafas de 0,75 L não são 675 L
 * (900 × 0,75), e sim 4.050 L (900 × 6 × 0,75).
 */
export function detectBoxBottleMistake(
  packages: number,
  unitsPerPackage: number,
  unitCapacityLiters: number,
  informedTotalLiters: number,
  toleranceLiters = 0.5,
): BoxBottleMistakeResult {
  const correctTotalLiters = calculateTotalVolume(packages, unitsPerPackage, unitCapacityLiters);
  const mistakenAssumedTotalLiters = round2(packages * unitCapacityLiters);

  const matchesMistake =
    unitsPerPackage > 1 &&
    Math.abs(informedTotalLiters - mistakenAssumedTotalLiters) <= toleranceLiters &&
    Math.abs(informedTotalLiters - correctTotalLiters) > toleranceLiters;

  return {
    detected: matchesMistake,
    correctTotalLiters,
    mistakenAssumedTotalLiters,
  };
}

export interface FieldPresenceResult {
  present: boolean;
  missingFrom: DocumentType[];
}

/** Verifica se um campo está presente em todos os documentos informados. */
export function validateFieldPresence(
  documents: DocumentFieldSet[],
  fieldKey: string,
  requiredIn: DocumentType[],
): FieldPresenceResult {
  const relevant = documents.filter((d) => requiredIn.includes(d.documentType));
  const missingFrom = relevant
    .filter((d) => !d.fields[fieldKey] || !d.fields[fieldKey]?.trim())
    .map((d) => d.documentType);
  return { present: missingFrom.length === 0, missingFrom };
}

export interface FieldConsistencyResult {
  consistent: boolean;
  values: { documentType: DocumentType; value: string }[];
}

function collectValues(documents: DocumentFieldSet[], fieldKey: string): { documentType: DocumentType; value: string }[] {
  return documents
    .filter((d) => d.fields[fieldKey]?.trim())
    .map((d) => ({ documentType: d.documentType, value: d.fields[fieldKey] as string }));
}

/** RULE-002: o lote deve ser igual entre todos os documentos que o mencionam. */
export function validateBatchConsistency(documents: DocumentFieldSet[]): FieldConsistencyResult {
  const values = collectValues(documents, "numero_lote");
  const consistent = values.every((v) => compareNormalized(v.value, values[0]?.value));
  return { consistent: values.length <= 1 || consistent, values };
}

/** RULE-003: número do laudo presente no Anexo IX e no documento de análise. */
export function validateLabReportPresence(documents: DocumentFieldSet[]): FieldPresenceResult {
  return validateFieldPresence(documents, "numero_laudo", ["anexo_ix", "laudo_analise"]);
}

/** RULE-006: indicação geográfica coerente entre os documentos que a mencionam. */
export function validateGeographicalIndication(documents: DocumentFieldSet[]): FieldConsistencyResult {
  const values = collectValues(documents, "indicacao_geografica");
  const consistent = values.every((v) => compareNormalized(v.value, values[0]?.value));
  return { consistent: values.length <= 1 || consistent, values };
}

/** RULE-007: produtor/engarrafador coerente entre certificado, laudo e demais documentos. */
export function validateProducerConsistency(documents: DocumentFieldSet[]): FieldConsistencyResult {
  const values = collectValues(documents, "produtor");
  const consistent = values.every((v) => compareNormalized(v.value, values[0]?.value));
  return { consistent: values.length <= 1 || consistent, values };
}

export interface ScoreableAlert {
  severity: "critica" | "alta" | "media" | "baixa" | "informativa";
}

const SEVERITY_PENALTY: Record<ScoreableAlert["severity"], number> = {
  critica: 30,
  alta: 15,
  media: 7,
  baixa: 3,
  informativa: 0,
};

/** Score de conformidade de 0 a 100, penalizado conforme a severidade de cada alerta ativo. */
export function scoreDossier(alerts: ScoreableAlert[]): number {
  const penalty = alerts.reduce((total, alert) => total + SEVERITY_PENALTY[alert.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
