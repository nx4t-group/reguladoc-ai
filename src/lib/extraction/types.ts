import type { DocumentType } from "@/lib/constants";

export interface DossierContext {
  importerName: string;
  exporterName?: string | null;
  producerName?: string | null;
  countryOrigin?: string | null;
  productName: string;
  brand: string;
  vintage?: string | null;
  geographicalIndication?: string | null;
  batchNumber?: string | null;
  packageType?: string | null;
  packageCount?: number | null;
  unitsPerPackage?: number | null;
  unitCapacityLiters?: number | null;
  informedVolumeLiters?: number | null;
}

export interface ExtractionInput {
  documentType: DocumentType;
  filename: string;
  dossierContext: DossierContext;
  filePath?: string;
  /**
   * Permite simular divergências reais entre documentos (útil em seeds de
   * demonstração): sobrepõe os valores gerados a partir do contexto do
   * dossiê, como se o OCR tivesse lido um documento físico diferente.
   */
  fieldOverrides?: Record<string, string | null | undefined>;
}

export interface ExtractedFieldValue {
  key: string;
  value: string;
  confidence: number;
}

export interface DocumentExtractionAdapter {
  readonly id: string;
  readonly label: string;
  readonly isSimulated: boolean;
  extract(input: ExtractionInput): Promise<ExtractedFieldValue[]>;
}
