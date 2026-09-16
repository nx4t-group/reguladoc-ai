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

describe("IRREGULARIDADE DE TESTE — RULE-003 Laudo de Análise (esperado 2291/26 | informado 2290/26)", () => {
  it("detecta divergência de número do laudo entre Anexo IX (2291/26) e Laudo de Análise (2290/26)", () => {
    const divergingDocuments: DocumentFieldSet[] = [
      {
        documentType: "anexo_ix",
        fields: {
          numero_laudo: "2291/26",
          numero_lote: "LVT25260101",
          marca: "Tapada do Fidalgo",
        },
      },
      {
        documentType: "laudo_analise",
        fields: {
          numero_laudo: "2290/26",
          numero_lote: "LVT25260101",
          teor_alcoolico: "13,5% vol",
          acidez_total: "5,3 g/L",
          acidez_volatil: "0,65 g/L",
          acucares_totais: "1,5 g/L",
          metanol: "180 mg/L",
          ph: "3,65",
        },
      },
    ];

    const result = runRuleEngine({ dossier: cleanDossier, documents: divergingDocuments });
    const laudoFinding = result.findings.find((f) => f.ruleCode === "RULE-003");

    expect(laudoFinding).toBeDefined();
    expect(laudoFinding?.title).toBe("Número de relatório/laudo divergente");
    expect(laudoFinding?.message).toContain('("2291/26") diverge de Laudo de Análise ("2290/26")');
    expect(laudoFinding?.severity).toBe("alta");
  });

  it("extrai corretamente esperado (2291/26) e informado (2290/26) a partir de texto sintético ou PDF", async () => {
    const { parseDocumentFieldsFromPdfText } = await import("@/lib/extraction/text-field-parser");
    const testText = ["IRREGULARIDADE DE TESTE Laudo de Analise: esperado 2291/26 | informado 2290/26"];

    const anexoFields = parseDocumentFieldsFromPdfText("anexo_ix", testText);
    const laudoFields = parseDocumentFieldsFromPdfText("laudo_analise", testText);

    expect(anexoFields.numero_laudo).toBe("2291/26");
    expect(laudoFields.numero_laudo).toBe("2290/26");
  });
});

describe("IRREGULARIDADE DE TESTE — RULE-008 Volume Total (esperado 2.400 L | informado 2.450 L no PACKING LIST)", () => {
  it("detecta divergência de volume total no Packing List (esperado 2.400 L | informado 2.450 L)", () => {
    const serraAzulDossier: RuleDossierContext = {
      brand: "Herdade Serra Azul",
      productName: "Vinho Fino Tinto Seco",
      vintage: "2025",
      geographicalIndication: "DOURO",
      batchNumber: "LVT25260101",
      informedVolumeLiters: 2400,
    };

    const documentsWithVolumeIrregularity: DocumentFieldSet[] = [
      {
        documentType: "packing_list",
        documentId: "doc-pk-01",
        fields: {
          tipo_embalagem: "Caixas de 6 garrafas",
          numero_embalagens: "600",
          unidades_por_embalagem: "6",
          volume_total_informado: "2.450 L",
          numero_lote: "LVT25260101",
        },
      },
    ];

    const result = runRuleEngine({ dossier: serraAzulDossier, documents: documentsWithVolumeIrregularity });
    const volumeFinding = result.findings.find((f) => f.ruleCode === "RULE-008");

    expect(volumeFinding).toBeDefined();
    expect(volumeFinding?.severity).toBe("critica");
    expect(volumeFinding?.title).toBe("Divergência no volume total do Packing List");
    expect(volumeFinding?.message).toContain("2.450");
    expect(volumeFinding?.message).toContain("2.400");
  });

  it("extrai campos do dossiê e do Packing List a partir da string de teste do usuário", async () => {
    const { parseDossierFieldsFromPdfText, parseDocumentFieldsFromPdfText } = await import("@/lib/extraction/text-field-parser");
    const testText = [
      "IRREGULARIDADE DE TESTE",
      "Herdade Serra Azul",
      "Volume Total: esperado 2.400 L | informado 2.450 L no PACKING LIST",
    ];

    const dossierFields = parseDossierFieldsFromPdfText(testText);
    expect(dossierFields.brand).toBe("Herdade Serra Azul");
    expect(dossierFields.informedVolumeLiters).toBe("2400");

    const packingFields = parseDocumentFieldsFromPdfText("packing_list", testText, {
      brand: dossierFields.brand ?? "Herdade Serra Azul",
      informedVolumeLiters: 2400,
    });
    expect(packingFields.volume_total_informado).toBe("2.450 L");
  });

  it("extrai fielmente tabela de Packing List (400 caixas, 8 unid, 0.75 L, 2.450 L) sem injetar peso bruto/líquido fantasmas", async () => {
    const { parseDossierFieldsFromPdfText, parseDocumentFieldsFromPdfText } = await import("@/lib/extraction/text-field-parser");
    const realTablePdfText = [
      "PACKING LIST - TESTE",
      "Documento logistico ficticio para homologacao do motor de regras.",
      "Packing List n.: TEST-PL-TEST-1608 | Data: 15/04/2026",
      "Exporter: Herdade Serra Azul Vinhos, Lda. - EMPRESA FICTICIA",
      "Importer: SERRA AZUL IMPORTACAO DE BEBIDAS LTDA. - EMPRESA FICTICIA",
      "Origin: PORTUGAL | Destination: Brasil",
      "DETALHAMENTO DA CARGA",
      "Produto | Marca | Lote | Caixas | Unid./caixa | Total unid. | Capacidade | Volume total | Vinho Fino Tinto Seco | Herdade Serra Azul 2025 | HSA25071302 | 400 | 8 | 3200 | 0.75 L | 2.450 L",
    ];

    // 1. Extração para o dossiê
    const dossierFields = parseDossierFieldsFromPdfText(realTablePdfText);
    expect(dossierFields.packageCount).toBe("400");
    expect(dossierFields.unitsPerPackage).toBe("8");
    expect(dossierFields.unitCapacityLiters).toBe("0.75");
    expect(dossierFields.informedVolumeLiters).toBe("2450");
    expect(dossierFields.batchNumber).toBe("HSA25071302");
    expect(dossierFields.brand).toBe("Herdade Serra Azul 2025");

    // 2. Extração do documento Packing List
    const docFields = parseDocumentFieldsFromPdfText("packing_list", realTablePdfText);
    expect(docFields.volume_total_informado).toBe("2.450 L");
    expect(docFields.numero_embalagens).toBe("400");
    expect(docFields.unidades_por_embalagem).toBe("8");
    expect(docFields.numero_lote).toBe("HSA25071302");

    // 3. Garantia de fidedignidade: NÃO deve inventar pesos que não existem no PDF
    expect(docFields.peso_bruto).toBeUndefined();
    expect(docFields.peso_liquido).toBeUndefined();

    // 4. Execução do motor de regras: deve detectar divergência entre 400 * 8 * 0.75 = 2.400 L e 2.450 L
    const result = runRuleEngine({
      dossier: {
        brand: "Herdade Serra Azul 2025",
        productName: "Vinho Fino Tinto Seco",
        batchNumber: "HSA25071302",
        packageCount: 400,
        unitsPerPackage: 8,
        unitCapacityLiters: 0.75, // Calculado = 2.400 L
        informedVolumeLiters: 2400,
      },
      documents: [
        {
          documentType: "packing_list",
          documentId: "pl-serra-azul",
          fields: docFields,
        },
      ],
    });

    const volFinding = result.findings.find((f) => f.ruleCode === "RULE-008");
    expect(volFinding).toBeDefined();
    expect(volFinding?.severity).toBe("critica");
    expect(volFinding?.message).toContain("2.450");
    expect(volFinding?.message).toContain("2.400");
  });
});

