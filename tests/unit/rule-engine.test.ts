import { describe, expect, it } from "vitest";
import { runRuleEngine } from "@/lib/rules/engine";
import type { DocumentFieldSet } from "@/lib/rules/calculations";
import type { RuleDossierContext } from "@/lib/rules/definitions";

const cleanDossier: RuleDossierContext = {
  brand: "Tapada do Fidalgo",
  productName: "Vinho Fino Tinto Seco",
  vintage: "2025",
  geographicalIndication: "Regional Alentejano",
  batchNumber: "LVT25260101",
  packageCount: 800,
  unitsPerPackage: 6,
  unitCapacityLiters: 0.75,
  informedVolumeLiters: 3600,
};

const cleanDocuments: DocumentFieldSet[] = [
  {
    documentType: "anexo_ix",
    fields: {
      marca: "Tapada do Fidalgo",
      denominacao: "Vinho Fino Tinto Seco",
      numero_lote: "LVT25260101",
      numero_laudo: "2025/1875",
      indicacao_geografica: "Regional Alentejano",
    },
  },
  {
    documentType: "certificado_origem",
    fields: { marca: "Tapada do Fidalgo", produtor: "Granacer", numero_lote: "LVT25260101", indicacao_geografica: "Regional Alentejano" },
  },
  {
    documentType: "laudo_analise",
    fields: {
      numero_laudo: "2025/1875",
      numero_lote: "LVT25260101",
      produtor: "Granacer",
      teor_alcoolico: "13,5% vol",
      acidez_total: "5,4 g/L",
      acidez_volatil: "0,52 g/L",
      acucares_totais: "3,1 g/L",
      metanol: "110 mg/L",
      ph: "3,42",
    },
  },
  { documentType: "invoice", fields: { marca: "Tapada do Fidalgo", numero_lote: "LVT25260101" } },
  { documentType: "packing_list", fields: { numero_lote: "LVT25260101", marca: "Tapada do Fidalgo" } },
  { documentType: "rotulo", fields: { marca: "Tapada do Fidalgo", indicacao_geografica: "Regional Alentejano" } },
];

describe("runRuleEngine — dossiê limpo (equivalente ao DEMO-IMP-0001)", () => {
  it("não gera alertas críticos e score fica em 100", () => {
    const result = runRuleEngine({ dossier: cleanDossier, documents: cleanDocuments });
    const critical = result.findings.filter((f) => f.severity === "critica");
    expect(critical).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it("grava snapshot de versão para todas as regras do catálogo", () => {
    const result = runRuleEngine({ dossier: cleanDossier, documents: cleanDocuments });
    expect(result.rulesVersionSnapshot.length).toBeGreaterThanOrEqual(15);
    expect(result.rulesVersionSnapshot.map((r) => r.code)).toContain("RULE-009");
  });
});

describe("runRuleEngine — dossiê com erros (equivalente ao DEMO-IMP-0002)", () => {
  const brokenDossier: RuleDossierContext = {
    ...cleanDossier,
    brand: "Quinta das Carvalhas",
    informedVolumeLiters: 675,
    packageCount: 900,
  };

  const brokenDocuments: DocumentFieldSet[] = [
    {
      documentType: "anexo_ix",
      fields: {
        marca: "Quinta das Carvalhas",
        denominacao: "Vinho Fino Tinto Seco",
        numero_lote: "LVT25260101",
        // numero_laudo propositalmente ausente
      },
    },
    { documentType: "certificado_origem", fields: { marca: "Quinta das Carvalhas", numero_lote: "LVT25260101" } },
    { documentType: "laudo_analise", fields: { numero_laudo: "2025/1875", numero_lote: "LVT25260101" } },
    { documentType: "invoice", fields: { marca: "Carvalhas", numero_lote: "LVT25260101" } },
    { documentType: "packing_list", fields: { numero_lote: "LVT25260101" } },
    { documentType: "rotulo", fields: { marca: "Carvalhas" } },
  ];

  it("detecta o erro caixa x garrafa (675 L informado, 4.050 L correto)", () => {
    const result = runRuleEngine({ dossier: brokenDossier, documents: brokenDocuments });
    const boxBottle = result.findings.find((f) => f.ruleCode === "RULE-009");
    expect(boxBottle).toBeDefined();
    expect(boxBottle?.severity).toBe("critica");
    expect((boxBottle?.evidence as { correctTotalLiters?: number } | undefined)?.correctTotalLiters).toBe(4050);
  });

  it("detecta divergência de marca (Quinta das Carvalhas vs Carvalhas)", () => {
    const result = runRuleEngine({ dossier: brokenDossier, documents: brokenDocuments });
    const brandFinding = result.findings.find((f) => f.ruleCode === "RULE-004");
    expect(brandFinding).toBeDefined();
    expect(brandFinding?.severity).toBe("alta");
  });

  it("detecta laudo ausente no Anexo IX (RULE-003)", () => {
    const result = runRuleEngine({ dossier: brokenDossier, documents: brokenDocuments });
    expect(result.findings.some((f) => f.ruleCode === "RULE-003")).toBe(true);
  });

  it("score final fica bem abaixo de 50 (não recomendado para registro)", () => {
    const result = runRuleEngine({ dossier: brokenDossier, documents: brokenDocuments });
    expect(result.score).toBeLessThan(50);
  });
});

describe("runRuleEngine — RULE-013 documento obrigatório ausente", () => {
  it("sinaliza cada tipo de documento obrigatório que não foi enviado", () => {
    const result = runRuleEngine({
      dossier: cleanDossier,
      documents: [{ documentType: "invoice", fields: { marca: "Tapada do Fidalgo" } }],
    });
    const missingDocFindings = result.findings.filter((f) => f.ruleCode === "RULE-013");
    // Anexo IX, Certificado de Origem, Laudo de Análise, Packing List e Rótulo ausentes.
    expect(missingDocFindings.length).toBe(5);
    expect(missingDocFindings.map((f) => (f.evidence as { documentType?: string } | undefined)?.documentType)).toContain("anexo_ix");
  });

  it("não sinaliza nada quando todos os documentos obrigatórios estão presentes", () => {
    const result = runRuleEngine({ dossier: cleanDossier, documents: cleanDocuments });
    expect(result.findings.filter((f) => f.ruleCode === "RULE-013")).toHaveLength(0);
  });
});
