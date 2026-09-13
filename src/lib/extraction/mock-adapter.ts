import type { DocumentType } from "@/lib/constants";
import { calculateTotalVolume } from "@/lib/rules/calculations";
import type { DocumentExtractionAdapter, DossierContext, ExtractedFieldValue, ExtractionInput } from "./types";

const DEFAULT_LAB_PARAMS: Record<string, string> = {
  teor_alcoolico: "13,6% vol",
  acidez_total: "5,3 g/L",
  acidez_volatil: "0,85 g/L",
  acucares_totais: "1,5 g/L",
  extrato_seco_reduzido: "34,0 g/L",
  extrato_seco_total: "34,2 g/L",
  metanol: "204,9 mg/L",
  ph: "3,69",
  sulfatos: "< 1,0 g/L",
  laboratorio: "CVRA - Comissão Vitivinícola Regional Alentejana",
  observacao_acreditacao: "Ensaios realizados sob escopo de acreditação do laboratório CVRA.",
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
  return "3.600 L";
}

function baseFieldsForDocument(documentType: DocumentType, ctx: DossierContext): Record<string, string | undefined> {
  const common = {
    marca: ctx.brand || "Tapada do Fidalgo 2025",
    denominacao: ctx.productName || "Vinho Fino Tinto Seco",
    produtor: ctx.producerName || "Granacer - Administração de Bens, S.A.",
    exportador: ctx.exporterName || "Granacer - Administração de Bens, S.A.",
    importador: ctx.importerName || "BARRINHAS COMÉRCIO E IMPORTAÇÃO DE BEBIDAS E CEREAIS LTDA.",
    pais_origem: ctx.countryOrigin || "Portugal",
    numero_lote: ctx.batchNumber || "LVT25260101",
    indicacao_geografica: ctx.geographicalIndication || "REGIONAL ALENTEJANO",
    safra: ctx.vintage || "2025",
    tipo_embalagem: ctx.packageType || "Caixas de 6 garrafas",
    numero_embalagens: ctx.packageCount ? fmtNumber(ctx.packageCount) : "800",
    unidades_por_embalagem: ctx.unitsPerPackage ? fmtNumber(ctx.unitsPerPackage) : "6",
    capacidade_unitaria: ctx.unitCapacityLiters ? fmtNumber(ctx.unitCapacityLiters, " L") : "0,75 L",
    volume_total_informado: informedOrCalculatedVolume(ctx),
  };

  switch (documentType) {
    case "anexo_ix":
      return {
        registro_mapa: "RJ-000500-2",
        cnpj: "36.167.492/0001-51",
        referencia_normativa: "Instrução Normativa MAPA nº 76/2018",
        data_referencia: "19/02/2026",
        numero_laudo: "1875/26",
        numero_lote: common.numero_lote,
      };
    case "certificado_origem":
      return {
        numero_certificado_origem: "959",
        orgao_emissor: "CVRA - Comissão Vitivinícola Regional Alentejana",
        indicacao_geografica: common.indicacao_geografica,
        pais_origem: common.pais_origem,
        safra: common.safra,
        data_emissao: "19/02/2026",
        numero_lote: common.numero_lote,
      };
    case "laudo_analise":
      return {
        numero_laudo: "1875/26",
        laboratorio: "CVRA - Comissão Vitivinícola Regional Alentejana",
        data_laudo: "19/02/2026",
        finalidade: "EXPORTAÇÃO",
        numero_lote: common.numero_lote,
        ...DEFAULT_LAB_PARAMS,
      };
    case "cii":
      return {
        numero_certificado: "I2400139612",
        orgao_emissor: "MAPA — Defesa Agropecuária",
        data_emissao: "19/02/2026",
        apto_inapto: "Apto",
        numero_lote: common.numero_lote,
      };
    case "invoice":
      return {
        numero_invoice: "TEST-INV-2026-001",
        data_invoice: "19/02/2026",
        incoterm: "FOB",
        valor_total: "EUR 12.000,00",
        condicao_pagamento: "30 dias líquido",
        numero_lote: common.numero_lote,
      };
    case "packing_list":
      return {
        tipo_embalagem: common.tipo_embalagem,
        numero_embalagens: common.numero_embalagens,
        unidades_por_embalagem: common.unidades_por_embalagem,
        volume_total_informado: common.volume_total_informado,
        peso_bruto: "4.250 kg",
        peso_liquido: "3.600 kg",
        numero_lote: common.numero_lote,
      };
    case "rotulo":
      return {
        teor_alcoolico: "13,6% vol.",
        indicacao_geografica: "VINHO REGIONAL ALENTEJANO",
        denominacao: common.denominacao,
        alergênicos_avisos: "Contém Sulfitos • Evite o consumo excessivo",
        capacidade_unitaria: common.capacidade_unitaria,
        registro_mapa: "RJ-000500-2",
        numero_lote: common.numero_lote,
      };
    case "complementar":
    case "outro":
    default:
      return {
        observacoes: "Documento complementar anexado ao dossiê para suporte à análise.",
      };
  }
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
