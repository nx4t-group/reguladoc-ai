import { describe, expect, it } from "vitest";
import {
  calculateTotalVolume,
  compareBrand,
  compareNormalized,
  detectBoxBottleMistake,
  normalizeText,
  scoreDossier,
  validateBatchConsistency,
  validateGeographicalIndication,
  validateProducerConsistency,
  validateLabReportPresence,
  type DocumentFieldSet,
} from "@/lib/rules/calculations";

describe("calculateTotalVolume", () => {
  it("calcula 800 caixas x 6 garrafas x 0,75 L = 3.600 L", () => {
    expect(calculateTotalVolume(800, 6, 0.75)).toBe(3600);
  });

  it("retorna 0 quando algum parâmetro não é finito", () => {
    expect(calculateTotalVolume(NaN, 6, 0.75)).toBe(0);
    expect(calculateTotalVolume(800, Infinity, 0.75)).toBe(0);
    expect(calculateTotalVolume(800, 6, -Infinity)).toBe(0);
  });
});

describe("detectBoxBottleMistake", () => {
  it("detecta 900 caixas de 6 garrafas de 0,75 L informadas como 675 L (deveria ser 4.050 L)", () => {
    const result = detectBoxBottleMistake(900, 6, 0.75, 675);
    expect(result.detected).toBe(true);
    expect(result.correctTotalLiters).toBe(4050);
    expect(result.mistakenAssumedTotalLiters).toBe(675);
  });

  it("não detecta o erro quando o volume informado bate com o volume correto", () => {
    const result = detectBoxBottleMistake(800, 6, 0.75, 3600);
    expect(result.detected).toBe(false);
  });

  it("não detecta quando o volume informado não corresponde a nenhum dos dois cálculos", () => {
    const result = detectBoxBottleMistake(800, 6, 0.75, 1200);
    expect(result.detected).toBe(false);
  });

  it("não detecta erro quando unitsPerPackage é 1 (não há distinção caixa/garrafa)", () => {
    const result = detectBoxBottleMistake(500, 1, 0.75, 375);
    expect(result.detected).toBe(false);
  });
});

describe("normalizeText", () => {
  it("coloca em caixa alta, remove acentos e pontuação, e colapsa espaços", () => {
    expect(normalizeText("  Tapada   do Fidalgo, S.A.!  ")).toBe("TAPADA DO FIDALGO S A");
  });

  it("retorna string vazia para valores nulos ou vazios", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText("")).toBe("");
  });

  it("compareNormalized ignora acentuação e caixa", () => {
    expect(compareNormalized("Alentejano", "ALENTEJANO")).toBe(true);
    expect(compareNormalized("São Paulo", "Sao Paulo")).toBe(true);
    expect(compareNormalized("Alentejano", "Douro")).toBe(false);
    expect(compareNormalized("", "Douro")).toBe(false);
    expect(compareNormalized(null, undefined)).toBe(false);
  });
});

describe("compareBrand", () => {
  it("trata a safra como complemento equivalente", () => {
    const result = compareBrand("Tapada do Fidalgo 2025", "Tapada do Fidalgo", { vintage: "2025" });
    expect(result.kind).toBe("equivalent_with_note");
  });

  it("reconhece marcas idênticas como exact", () => {
    expect(compareBrand("Tapada do Fidalgo", "TAPADA DO FIDALGO").kind).toBe("exact");
  });

  it("identifica divergência real de marca (Quinta das Carvalhas vs Carvalhas), mesmo sendo substring", () => {
    const result = compareBrand("Quinta das Carvalhas", "Carvalhas", { vintage: "2025" });
    expect(result.kind).toBe("divergent");
  });

  it("identifica divergência real sem qualquer relação textual", () => {
    const result = compareBrand("Tapada do Fidalgo", "Herdade do Esporão", { vintage: "2025" });
    expect(result.kind).toBe("divergent");
  });

  it("retorna insufficient_data se um dos valores for vazio ou nulo", () => {
    expect(compareBrand(null, "Tapada").kind).toBe("insufficient_data");
    expect(compareBrand("Tapada", "").kind).toBe("insufficient_data");
  });
});

describe("scoreDossier", () => {
  it("100 quando não há alertas", () => {
    expect(scoreDossier([])).toBe(100);
  });

  it("aplica pesos por severidade (crítica -30, alta -15, média -7, baixa -3, informativa 0)", () => {
    expect(
      scoreDossier([{ severity: "critica" }, { severity: "alta" }, { severity: "media" }, { severity: "baixa" }, { severity: "informativa" }]),
    ).toBe(100 - 30 - 15 - 7 - 3 - 0);
  });

  it("nunca fica abaixo de 0", () => {
    expect(scoreDossier([{ severity: "critica" }, { severity: "critica" }, { severity: "critica" }, { severity: "critica" }])).toBe(0);
  });
});

describe("validateBatchConsistency", () => {
  const doc = (documentType: DocumentFieldSet["documentType"], numero_lote?: string): DocumentFieldSet => ({
    documentType,
    fields: { numero_lote },
  });

  it("consistente quando todos os documentos têm o mesmo lote", () => {
    const result = validateBatchConsistency([
      doc("anexo_ix", "LVT25260101"),
      doc("laudo_analise", "LVT25260101"),
      doc("invoice", "lvt25260101"),
    ]);
    expect(result.consistent).toBe(true);
  });

  it("inconsistente quando os lotes divergem entre documentos", () => {
    const result = validateBatchConsistency([doc("anexo_ix", "LVT25260101"), doc("laudo_analise", "LVT25260999")]);
    expect(result.consistent).toBe(false);
  });

  it("consistente quando apenas um documento informa lote", () => {
    const result = validateBatchConsistency([doc("anexo_ix", "LVT25260101"), doc("laudo_analise", undefined)]);
    expect(result.consistent).toBe(true);
  });
});

describe("validateGeographicalIndication", () => {
  const doc = (documentType: DocumentFieldSet["documentType"], gi?: string): DocumentFieldSet => ({
    documentType,
    fields: { indicacao_geografica: gi },
  });

  it("consistente quando todos os documentos indicam a mesma IG", () => {
    const result = validateGeographicalIndication([
      doc("certificado_origem", "Alentejo"),
      doc("anexo_ix", "ALENTEJO"),
    ]);
    expect(result.consistent).toBe(true);
  });

  it("inconsistente quando as indicações geográficas divergem", () => {
    const result = validateGeographicalIndication([
      doc("certificado_origem", "Alentejo"),
      doc("anexo_ix", "Douro"),
    ]);
    expect(result.consistent).toBe(false);
  });
});

describe("validateProducerConsistency", () => {
  const doc = (documentType: DocumentFieldSet["documentType"], produtor?: string): DocumentFieldSet => ({
    documentType,
    fields: { produtor },
  });

  it("consistente quando os produtores conferem entre documentos", () => {
    const result = validateProducerConsistency([
      doc("certificado_origem", "Adega de Borba CRL"),
      doc("anexo_ix", "ADEGA DE BORBA CRL"),
    ]);
    expect(result.consistent).toBe(true);
  });

  it("inconsistente quando o produtor diverge entre documentos", () => {
    const result = validateProducerConsistency([
      doc("certificado_origem", "Adega de Borba"),
      doc("anexo_ix", "Quinta do Crasto"),
    ]);
    expect(result.consistent).toBe(false);
  });
});

describe("validateLabReportPresence", () => {
  const doc = (documentType: DocumentFieldSet["documentType"], numero_laudo?: string): DocumentFieldSet => ({
    documentType,
    fields: { numero_laudo },
  });

  it("presente quando número de laudo está preenchido em anexo_ix e laudo_analise", () => {
    const result = validateLabReportPresence([
      doc("anexo_ix", "LAUDO-2025-01"),
      doc("laudo_analise", "LAUDO-2025-01"),
    ]);
    expect(result.present).toBe(true);
    expect(result.missingFrom).toHaveLength(0);
  });

  it("detecta ausência quando anexo_ix não possui número do laudo", () => {
    const result = validateLabReportPresence([
      doc("anexo_ix", ""),
      doc("laudo_analise", "LAUDO-2025-01"),
    ]);
    expect(result.present).toBe(false);
    expect(result.missingFrom).toContain("anexo_ix");
  });
});
