import { describe, expect, it } from "vitest";
import type { DocumentFieldSet } from "@/lib/rules/calculations";
import type { RuleDossierContext } from "@/lib/rules/definitions";
import { runRuleEngine } from "@/lib/rules/engine";
import { assertCapability, hasCapability } from "@/lib/permissions";
import { MANDATORY_LEGAL_DISCLAIMER, scoreClassification } from "@/lib/constants";

describe("Bateria de Homologação Enterprise — Casos A ao G", () => {
  // -------------------------------------------------------------------------
  // CASO A: Golden Case (Vinho Chileno Perfeito)
  // -------------------------------------------------------------------------
  it("Caso A: Dossiê completo sem divergências obtém score 100 e recomendação para liberação sem ressalvas", () => {
    const dossierA: RuleDossierContext = {
      brand: "Reserva de los Andes",
      productName: "Vinho Fino Tinto Seco",
      vintage: "2022",
      geographicalIndication: "Valle Central",
      batchNumber: "L-2024-CH-01",
      packageCount: 800,
      unitsPerPackage: 6,
      unitCapacityLiters: 0.75,
      informedVolumeLiters: 3600, // 800 * 6 * 0.75 = 3600
    };

    const documentsA: DocumentFieldSet[] = [
      {
        documentType: "anexo_ix",
        fields: {
          marca: "Reserva de los Andes",
          denominacao: "Vinho Fino Tinto Seco",
          numero_lote: "L-2024-CH-01",
          numero_laudo: "LAUDO-CH-9921",
          indicacao_geografica: "Valle Central",
        },
      },
      {
        documentType: "certificado_origem",
        fields: {
          marca: "Reserva de los Andes",
          produtor: "Viña Los Andes S.A.",
          numero_lote: "L-2024-CH-01",
          indicacao_geografica: "Valle Central",
        },
      },
      {
        documentType: "laudo_analise",
        fields: {
          numero_laudo: "LAUDO-CH-9921",
          numero_lote: "L-2024-CH-01",
          produtor: "Viña Los Andes S.A.",
          teor_alcoolico: "13,8% vol",
          acidez_total: "5,2 g/L",
          acidez_volatil: "0,48 g/L",
          acucares_totais: "2,8 g/L",
          metanol: "95 mg/L",
          ph: "3,55",
        },
      },
      {
        documentType: "invoice",
        fields: {
          marca: "Reserva de los Andes",
          numero_lote: "L-2024-CH-01",
        },
      },
      {
        documentType: "packing_list",
        fields: {
          marca: "Reserva de los Andes",
          numero_lote: "L-2024-CH-01",
          quantidade_volumes: "800",
          volume_total: "3600",
        },
      },
      {
        documentType: "rotulo",
        fields: {
          marca: "Reserva de los Andes",
          indicacao_geografica: "Valle Central",
          denominacao: "Vinho Fino Tinto Seco",
        },
      },
    ];

    const result = runRuleEngine({ dossier: dossierA, documents: documentsA });

    expect(result.score).toBe(100);
    expect(result.findings).toHaveLength(0);

    const classification = scoreClassification(result.score);
    expect(classification.label).toBe("Sem bloqueios documentais detectados");
    expect(classification.tone).toBe("success");
    expect(MANDATORY_LEGAL_DISCLAIMER).toContain("Não substitui os órgãos reguladores oficiais");
  });

  // -------------------------------------------------------------------------
  // CASO B: Divergência Crítica de Lote
  // -------------------------------------------------------------------------
  it("Caso B: Divergência de lote entre documentos dispara RULE-002 crítica e bloqueia liberação", () => {
    const dossierB: RuleDossierContext = {
      brand: "Château Latour",
      productName: "Vinho Fino Tinto",
      batchNumber: "L-2024-A",
      packageCount: 100,
      unitsPerPackage: 6,
      unitCapacityLiters: 0.75,
      informedVolumeLiters: 450,
    };

    const documentsB: DocumentFieldSet[] = [
      {
        documentType: "anexo_ix",
        fields: {
          marca: "Château Latour",
          numero_lote: "L-2024-A",
          numero_laudo: "L-900",
        },
      },
      {
        documentType: "invoice",
        fields: {
          marca: "Château Latour",
          numero_lote: "L-2024-B", // Divergência com Anexo IX
        },
      },
      {
        documentType: "certificado_origem",
        fields: {
          marca: "Château Latour",
          numero_lote: "L-2024-A",
        },
      },
      {
        documentType: "laudo_analise",
        fields: {
          numero_laudo: "L-900",
          numero_lote: "L-2024-A",
          acidez_total: "5,0 g/L",
          acidez_volatil: "0,5 g/L",
          acucares_totais: "2,0 g/L",
          metanol: "50 mg/L",
        },
      },
      { documentType: "packing_list", fields: { marca: "Château Latour", numero_lote: "L-2024-A" } },
      { documentType: "rotulo", fields: { marca: "Château Latour" } },
    ];

    const result = runRuleEngine({ dossier: dossierB, documents: documentsB });
    const batchFinding = result.findings.find((f) => f.ruleCode === "RULE-002");

    expect(batchFinding).toBeDefined();
    expect(batchFinding?.severity).toBe("critica");
    expect(result.score).toBeLessThanOrEqual(70);

    const classification = scoreClassification(result.score);
    expect(classification.tone).toBe("warning");
  });

  // -------------------------------------------------------------------------
  // CASO C: Inconsistência de Volume / Erro de Multiplicação
  // -------------------------------------------------------------------------
  it("Caso C: Inconsistência matemática de volume entre caixas x unidades x garrafa vs total dispara RULE-008", () => {
    const dossierC: RuleDossierContext = {
      brand: "Quinta do Sol",
      productName: "Vinho Tinto",
      batchNumber: "L-99",
      packageCount: 1000,
      unitsPerPackage: 6,
      unitCapacityLiters: 0.75, // 1000 * 6 * 0.75 = 4.500 Litros
      informedVolumeLiters: 5000, // Declarado incorretamente como 5.000 L
    };

    const documentsC: DocumentFieldSet[] = [
      { documentType: "anexo_ix", fields: { marca: "Quinta do Sol", numero_lote: "L-99", numero_laudo: "L-1" } },
      { documentType: "certificado_origem", fields: { marca: "Quinta do Sol", numero_lote: "L-99" } },
      {
        documentType: "laudo_analise",
        fields: {
          numero_laudo: "L-1",
          numero_lote: "L-99",
          teor_alcoolico: "13,0% vol",
          acidez_total: "5,0 g/L",
          acidez_volatil: "0,5 g/L",
          acucares_totais: "2,0 g/L",
          metanol: "50 mg/L",
        },
      },
      { documentType: "invoice", fields: { marca: "Quinta do Sol", numero_lote: "L-99" } },
      {
        documentType: "packing_list",
        fields: {
          marca: "Quinta do Sol",
          numero_lote: "L-99",
          quantidade_volumes: "1000",
          volume_total: "5000",
        },
      },
      { documentType: "rotulo", fields: { marca: "Quinta do Sol" } },
    ];

    const result = runRuleEngine({ dossier: dossierC, documents: documentsC });
    const volumeFinding = result.findings.find((f) => f.ruleCode === "RULE-008");

    expect(volumeFinding).toBeDefined();
    expect(volumeFinding?.severity).toBe("critica");
    expect(volumeFinding?.evidence?.calculated).toBe(4500);
    expect(volumeFinding?.evidence?.informedVolumeLiters).toBe(5000);
  });

  // -------------------------------------------------------------------------
  // CASO D: Documentação Fracionada / Recebimento Parcial
  // -------------------------------------------------------------------------
  it("Caso D: Durante recebimento fracionado (isAwaitingDocuments: true), RULE-013 não dispara como bloqueio", () => {
    const partialDossier: RuleDossierContext = {
      brand: "Bodega Norton",
      productName: "Malbec Reserva",
      batchNumber: "BN-2024-01",
      packageCount: 500,
      unitsPerPackage: 6,
      unitCapacityLiters: 0.75,
      informedVolumeLiters: 2250,
    };

    // Apenas Invoice e Packing List enviados até o momento
    const partialDocs: DocumentFieldSet[] = [
      { documentType: "invoice", fields: { marca: "Bodega Norton", numero_lote: "BN-2024-01" } },
      { documentType: "packing_list", fields: { marca: "Bodega Norton", numero_lote: "BN-2024-01" } },
    ];

    // Modo recebimento fracionado ativo
    const resultAwaiting = runRuleEngine({
      dossier: partialDossier,
      documents: partialDocs,
      isAwaitingDocuments: true,
    });

    const rule013Awaiting = resultAwaiting.findings.find((f) => f.ruleCode === "RULE-013");
    expect(rule013Awaiting).toBeUndefined(); // Não deve gerar inconformidade enquanto aguarda

    // Quando não está mais em modo de espera fracionada, RULE-013 deve acusar os faltantes
    const resultComplete = runRuleEngine({
      dossier: partialDossier,
      documents: partialDocs,
      isAwaitingDocuments: false,
    });

    const rule013Missing = resultComplete.findings.find((f) => f.ruleCode === "RULE-013");
    expect(rule013Missing).toBeDefined();
    expect(rule013Missing?.severity).toBe("alta");
  });

  // -------------------------------------------------------------------------
  // CASO E: Divergência Cadastral de Marca
  // -------------------------------------------------------------------------
  it("Caso E: Divergência de marca entre documentos ('Quinta do Sol' vs 'Quinta do Sol Reserva Especial') dispara RULE-004", () => {
    const dossierE: RuleDossierContext = {
      brand: "Quinta do Sol",
      productName: "Vinho Tinto",
      batchNumber: "L-2024-QS",
    };

    const documentsE: DocumentFieldSet[] = [
      { documentType: "anexo_ix", fields: { marca: "Quinta do Sol", numero_lote: "L-2024-QS", numero_laudo: "L-QS" } },
      { documentType: "certificado_origem", fields: { marca: "Quinta do Sol", numero_lote: "L-2024-QS" } },
      {
        documentType: "laudo_analise",
        fields: {
          numero_laudo: "L-QS",
          numero_lote: "L-2024-QS",
          teor_alcoolico: "13,0% vol",
          acidez_total: "5,0 g/L",
          acidez_volatil: "0,5 g/L",
          acucares_totais: "2,0 g/L",
          metanol: "50 mg/L",
        },
      },
      {
        documentType: "invoice",
        fields: {
          marca: "Quinta do Sol Reserva Especial", // Adicionou qualificador divergente
          numero_lote: "L-2024-QS",
        },
      },
      { documentType: "packing_list", fields: { marca: "Quinta do Sol", numero_lote: "L-2024-QS" } },
      { documentType: "rotulo", fields: { marca: "Quinta do Sol" } },
    ];

    const result = runRuleEngine({ dossier: dossierE, documents: documentsE });
    const brandFinding = result.findings.find((f) => f.ruleCode === "RULE-004");

    expect(brandFinding).toBeDefined();
    expect(brandFinding?.severity).toBe("alta");
  });

  // -------------------------------------------------------------------------
  // CASO F: Substituição de Documento e Resolução de Divergência
  // -------------------------------------------------------------------------
  it("Caso F: Nova versão do documento com lote correto sana a inconformidade de RULE-002", () => {
    const dossierF: RuleDossierContext = {
      brand: "Château Latour",
      productName: "Vinho Fino Tinto",
      batchNumber: "L-2024-A",
    };

    // Versão 2 da Invoice: corrigida com o lote 'L-2024-A' idêntico ao Anexo IX
    const documentsV2: DocumentFieldSet[] = [
      {
        documentType: "anexo_ix",
        fields: {
          marca: "Château Latour",
          denominacao: "Vinho Fino Tinto",
          numero_lote: "L-2024-A",
          numero_laudo: "L-1",
        },
      },
      { documentType: "certificado_origem", fields: { marca: "Château Latour", numero_lote: "L-2024-A" } },
      {
        documentType: "laudo_analise",
        fields: {
          numero_laudo: "L-1",
          numero_lote: "L-2024-A",
          teor_alcoolico: "13,5% vol",
          acidez_total: "5,0 g/L",
          acidez_volatil: "0,5 g/L",
          acucares_totais: "2,0 g/L",
          metanol: "50 mg/L",
          ph: "3,50",
        },
      },
      { documentType: "invoice", fields: { marca: "Château Latour", numero_lote: "L-2024-A" } }, // CORRIGIDO
      { documentType: "packing_list", fields: { marca: "Château Latour", numero_lote: "L-2024-A" } },
      {
        documentType: "rotulo",
        fields: {
          marca: "Château Latour",
          denominacao: "Vinho Fino Tinto",
        },
      },
    ];

    const resultV2 = runRuleEngine({ dossier: dossierF, documents: documentsV2 });
    const batchFinding = resultV2.findings.find((f) => f.ruleCode === "RULE-002");

    expect(batchFinding).toBeUndefined();
    expect(resultV2.findings).toEqual([]);
    expect(resultV2.score).toBe(100);
  });


  // -------------------------------------------------------------------------
  // CASO G: Governança, RBAC e Bloqueio de Decisão Server-Side
  // -------------------------------------------------------------------------
  describe("Caso G: Controle de Acesso e Governança Regulatória", () => {
    it("Analista tem permissão para upload e resolução de alertas, mas NÃO para aprovação de dossiê", () => {
      expect(hasCapability("analista", "DOCUMENT_UPLOAD")).toBe(true);
      expect(hasCapability("analista", "FINDING_RESOLVE")).toBe(true);
      expect(hasCapability("analista", "DOSSIER_APPROVE")).toBe(false);
      expect(hasCapability("analista", "FINDING_RECLASSIFY")).toBe(false);

      expect(() => assertCapability("analista", "DOSSIER_APPROVE")).toThrowError(
        /Acesso negado: a permissão \[DOSSIER_APPROVE\] é exigida/
      );
    });

    it("Gestor e Admin possuem capability DOSSIER_APPROVE e GOVERNANCE_MANAGE", () => {
      expect(hasCapability("gestor", "DOSSIER_APPROVE")).toBe(true);
      expect(hasCapability("gestor", "GOVERNANCE_MANAGE")).toBe(true);
      expect(hasCapability("admin", "DOSSIER_APPROVE")).toBe(true);
      expect(hasCapability("admin", "ADMIN_TENANT")).toBe(true);

      expect(() => assertCapability("gestor", "DOSSIER_APPROVE")).not.toThrow();
      expect(() => assertCapability("admin", "DOSSIER_APPROVE")).not.toThrow();
    });
  });
});
