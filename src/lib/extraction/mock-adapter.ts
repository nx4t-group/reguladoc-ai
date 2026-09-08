import type { DocumentType } from "@/lib/constants";
import { calculateTotalVolume } from "@/lib/rules/calculations";
import type { DocumentExtractionAdapter, DossierContext, ExtractedFieldValue, ExtractionInput } from "./types";

const DEFAULT_LAB_PARAMS: Record<string, string> = {
  teor_alcoolico: "13,5% vol",
  acidez_total: "5,4 g/L (ácido tartárico)",
  acidez_volatil: "0,52 g/L (ácido acético)",
  acucares_totais: "3,1 g/L",
  metanol: "110 mg/L",
  ph: "3,42",
  sulfatos: "0,68 g/L",
  observacao_acreditacao: "Ensaios realizados sob escopo de acreditação do laboratório.",
};

function fmtNumber(value: number | null | undefined, suffix = ""): string | undefined {
  if (value === null || value === undefined) return undefined;
  return `${value.toLocaleString("pt-BR")}${suffix}`;
}

function informedOrCalculatedVolume(ctx: DossierContext): string | undefined {
  if (ctx.informedVolumeLiters != null) return fmtNumber(ctx.informedVolumeLiters, " L");
  if (ctx.packageCount != null && ctx.unitsPerPackage != null && ctx.unitCapacityLiters != null) {
    return fmtNumber(calculateTotalVolume(ctx.packageCount, ctx.unitsPerPackage, ctx.unitCapacityLiters), " L");
  }
  return undefined;
}

function baseFieldsForDocument(documentType: DocumentType, ctx: DossierContext): Record<string, string | undefined> {
  const common = {
    marca: ctx.brand,
    denominacao: ctx.productName,
    produtor: ctx.producerName ?? undefined,
    exportador: ctx.exporterName ?? undefined,
    importador: ctx.importerName,
    pais_origem: ctx.countryOrigin ?? undefined,
    numero_lote: ctx.batchNumber ?? undefined,
    indicacao_geografica: ctx.geographicalIndication ?? undefined,
    safra: ctx.vintage ?? undefined,
    tipo_embalagem: ctx.packageType ?? undefined,
    numero_embalagens: fmtNumber(ctx.packageCount),
    unidades_por_embalagem: fmtNumber(ctx.unitsPerPackage),
    capacidade_unitaria: fmtNumber(ctx.unitCapacityLiters, " L"),
    volume_total_informado: informedOrCalculatedVolume(ctx),
  };

  switch (documentType) {
    case "anexo_ix":
      return {
        marca: common.marca,
        denominacao: common.denominacao,
        importador: common.importador,
        exportador: common.exportador,
        produtor: common.produtor,
        numero_lote: common.numero_lote,
        numero_laudo: `${new Date().getFullYear() - 1}/${Math.abs(hashCode(ctx.batchNumber ?? ctx.brand)) % 9000 + 1000}`,
        indicacao_geografica: common.indicacao_geografica,
        safra: common.safra,
        numero_embalagens: common.numero_embalagens,
        unidades_por_embalagem: common.unidades_por_embalagem,
        capacidade_unitaria: common.capacidade_unitaria,
        volume_total_informado: common.volume_total_informado,
        referencia_normativa: "Instrução Normativa MAPA nº 76/2018",
      };
    case "certificado_origem":
      return {
        numero_certificado: `CO-${Math.abs(hashCode(ctx.brand)) % 90000 + 10000}`,
        orgao_emissor: "Câmara de Comércio local",
        data_emissao: "2026-01-14",
        pais_origem: common.pais_origem,
        produtor: common.produtor,
        marca: common.marca,
        denominacao: common.denominacao,
        indicacao_geografica: common.indicacao_geografica,
        numero_lote: common.numero_lote,
      };
    case "laudo_analise":
      return {
        numero_laudo: `${new Date().getFullYear() - 1}/${Math.abs(hashCode(ctx.batchNumber ?? ctx.brand)) % 9000 + 1000}`,
        laboratorio: "Laboratório Enológico Central",
        data_laudo: "2026-01-10",
        finalidade: "Exportação / Importação",
        numero_lote: common.numero_lote,
        marca: common.marca,
        produtor: common.produtor,
        ...DEFAULT_LAB_PARAMS,
      };
    case "cii":
      return {
        numero_certificado: `CII-${Math.abs(hashCode(ctx.brand)) % 90000 + 10000}`,
        orgao_emissor: "MAPA — Defesa Agropecuária",
        data_emissao: "2026-01-20",
        apto_inapto: "Apto",
        marca: common.marca,
        produtor: common.produtor,
        numero_lote: common.numero_lote,
      };
    case "invoice":
      return {
        importador: common.importador,
        exportador: common.exportador,
        marca: common.marca,
        denominacao: common.denominacao,
        numero_lote: common.numero_lote,
        tipo_embalagem: common.tipo_embalagem,
        numero_embalagens: common.numero_embalagens,
        unidades_por_embalagem: common.unidades_por_embalagem,
        capacidade_unitaria: common.capacidade_unitaria,
        volume_total_informado: common.volume_total_informado,
      };
    case "packing_list":
      return {
        tipo_embalagem: common.tipo_embalagem,
        numero_embalagens: common.numero_embalagens,
        unidades_por_embalagem: common.unidades_por_embalagem,
        capacidade_unitaria: common.capacidade_unitaria,
        volume_total_informado: common.volume_total_informado,
        numero_lote: common.numero_lote,
        marca: common.marca,
      };
    case "rotulo":
      return {
        marca: common.marca,
        denominacao: common.denominacao,
        cor: "Tinto",
        teor_acucar: "Seco",
        safra: common.safra,
        uva: "Touriga Nacional, Aragonez, Trincadeira",
        indicacao_geografica: common.indicacao_geografica,
        denominacao_origem: undefined,
        importador: common.importador,
        pais_origem: common.pais_origem,
      };
    case "complementar":
    case "outro":
    default:
      return {
        observacoes: "Documento complementar anexado ao dossiê para suporte à análise.",
      };
  }
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

const CONFIDENCE_BY_KEY: Record<string, number> = {
  observacoes: 0.7,
  observacao_acreditacao: 0.75,
};

function confidenceFor(key: string): number {
  return CONFIDENCE_BY_KEY[key] ?? 0.93;
}

export class MockExtractionAdapter implements DocumentExtractionAdapter {
  readonly id = "mock";
  readonly label = "Mock (simulado)";
  readonly isSimulated = true;

  async extract(input: ExtractionInput): Promise<ExtractedFieldValue[]> {
    const base = baseFieldsForDocument(input.documentType, input.dossierContext);
    const merged: Record<string, string | undefined> = { ...base };
    for (const [key, value] of Object.entries(input.fieldOverrides ?? {})) {
      merged[key] = value ?? undefined;
    }

    return Object.entries(merged)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([key, value]) => ({ key, value, confidence: confidenceFor(key) }));
  }
}
