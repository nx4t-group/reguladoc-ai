/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { AUDIT_ACTIONS } from "../src/lib/audit";
import type { DocumentType } from "../src/lib/constants";
import { MockExtractionAdapter } from "../src/lib/extraction/mock-adapter";
import type { DossierContext } from "../src/lib/extraction/types";
import type { DocumentFieldSet } from "../src/lib/rules/calculations";
import { RULE_DEFINITIONS } from "../src/lib/rules/definitions";
import { runRuleEngine } from "../src/lib/rules/engine";

const prisma = new PrismaClient();
const extractor = new MockExtractionAdapter();

const now = () => new Date();

async function main() {
  console.log("Seeding RegulaDoc AI…");

  // -------------------------------------------------------------------
  // Organização e usuários
  // -------------------------------------------------------------------
  const organization = await prisma.organization.create({
    data: {
      name: "Comissária Brasil Demo",
      cnpj: "12.345.678/0001-90",
      plan: "professional",
    },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const [admin, gestor, analista] = await Promise.all([
    prisma.profile.create({ data: { name: "Admin Demo", email: "admin@demo.com", passwordHash } }),
    prisma.profile.create({ data: { name: "Gestor Demo", email: "gestor@demo.com", passwordHash } }),
    prisma.profile.create({ data: { name: "Analista Demo", email: "analista@demo.com", passwordHash } }),
  ]);

  await Promise.all([
    prisma.organizationMember.create({ data: { organizationId: organization.id, userId: admin.id, role: "admin" } }),
    prisma.organizationMember.create({ data: { organizationId: organization.id, userId: gestor.id, role: "gestor" } }),
    prisma.organizationMember.create({ data: { organizationId: organization.id, userId: analista.id, role: "analista" } }),
  ]);

  console.log("  ✓ Organização e 3 usuários (admin/gestor/analista @demo.com, senha demo1234)");

  // -------------------------------------------------------------------
  // Motor de regras — catálogo global versão 1
  // -------------------------------------------------------------------
  const ruleRows = await Promise.all(
    RULE_DEFINITIONS.map((rule) =>
      prisma.validationRule.create({
        data: {
          code: rule.code,
          name: rule.name,
          description: rule.description,
          category: rule.category,
          severity: rule.severity,
          sourceType: rule.sourceType,
          sourceReference: rule.sourceReference,
          version: 1,
          status: "ativa",
          errorMessage: rule.errorMessage,
          suggestion: rule.suggestion,
        },
      }),
    ),
  );
  const ruleByCode = new Map(ruleRows.map((r) => [r.code, r]));
  console.log(`  ✓ ${ruleRows.length} regras versionadas (RULE-001 a RULE-015)`);

  // -------------------------------------------------------------------
  // Monitor regulatório — fontes globais + itens de exemplo
  // -------------------------------------------------------------------
  const sources = await Promise.all(
    [
      { name: "MAPA — Defesa Agropecuária", url: "https://www.gov.br/agricultura/pt-br/assuntos/defesa-agropecuaria", authority: "MAPA" },
      { name: "Diário Oficial da União", url: "https://www.in.gov.br/leiturajornal", authority: "Imprensa Nacional" },
      { name: "Planalto — Legislação", url: "https://www.planalto.gov.br/ccivil_03/leis/", authority: "Presidência da República" },
      { name: "Receita Federal — Legislação Aduaneira", url: "https://www.gov.br/receitafederal", authority: "Receita Federal" },
      { name: "Portal Único Siscomex", url: "https://www.gov.br/siscomex", authority: "Portal Único" },
      { name: "ANVISA — Legislação", url: "https://www.gov.br/anvisa", authority: "ANVISA" },
    ].map((s) =>
      prisma.regulatorySource.create({
        data: { ...s, sourceType: "oficial", checkFrequency: "diaria", lastCheckedAt: now(), status: "ativa" },
      }),
    ),
  );

  const mapaSource = sources[0];
  const douSource = sources[1];

  await prisma.regulatoryItem.create({
    data: {
      sourceId: mapaSource.id,
      title: "Instrução Normativa nº 88/2026 — Atualização de parâmetros físico-químicos para vinhos importados",
      authority: "MAPA",
      publicationType: "instrucao_normativa",
      url: "https://www.gov.br/agricultura/pt-br/assuntos/defesa-agropecuaria",
      publishedAt: new Date("2026-07-10"),
      status: "novo",
      summary:
        "Ato normativo republica os limites de acidez volátil e metanol para vinhos importados, mantendo os valores vigentes e reforçando exigências de rastreabilidade de lote.",
      aiImpact: "Impacto baixo: os limites informados coincidem com os já utilizados nas regras RULE-010/011. Recomenda-se apenas atualizar a referência normativa das regras de laboratório.",
    },
  });

  await prisma.regulatoryItem.create({
    data: {
      sourceId: douSource.id,
      title: "Portaria conjunta MAPA/RFB sobre conferência documental prévia ao registro de DI de bebidas",
      authority: "Receita Federal / MAPA",
      publicationType: "portaria",
      url: "https://www.in.gov.br/leiturajornal",
      publishedAt: new Date("2026-06-28"),
      status: "em_analise",
      summary: "Reforça a exigência de conferência documental prévia (lote, laudo e certificado de origem) antes do registro da DI para bebidas importadas.",
      aiImpact: "Reforça diretamente as regras RULE-001, RULE-002 e RULE-013 já implementadas. Nenhuma alteração de regra necessária no momento — apenas registrar como referência normativa.",
      reviewerId: gestor.id,
    },
  });

  console.log(`  ✓ ${sources.length} fontes regulatórias + 2 publicações de exemplo`);

  // -------------------------------------------------------------------
  // Dossiê 1 — DEMO-IMP-0001 (limpo)
  // -------------------------------------------------------------------
  await seedDossier({
    internalNumber: "DEMO-IMP-0001",
    scenario: "clean",
    organizationId: organization.id,
    createdBy: analista,
    assignedTo: analista,
    reviewer: gestor,
    ruleByCode,
  });

  // -------------------------------------------------------------------
  // Dossiê 2 — DEMO-IMP-0002 (com erros propositais)
  // -------------------------------------------------------------------
  await seedDossier({
    internalNumber: "DEMO-IMP-0002",
    scenario: "broken",
    organizationId: organization.id,
    createdBy: analista,
    assignedTo: analista,
    reviewer: null,
    ruleByCode,
  });

  console.log("\nSeed concluído. Login de demonstração:");
  console.log("  admin@demo.com / gestor@demo.com / analista@demo.com — senha: demo1234");
}

interface SeedDossierParams {
  internalNumber: string;
  scenario: "clean" | "broken";
  organizationId: string;
  createdBy: { id: string };
  assignedTo: { id: string };
  reviewer: { id: string } | null;
  ruleByCode: Map<string, { id: string; code: string }>;
}

const DEMO_DOCUMENTS: DocumentType[] = [
  "anexo_ix",
  "certificado_origem",
  "laudo_analise",
  "cii",
  "invoice",
  "packing_list",
  "rotulo",
];

async function seedDossier(params: SeedDossierParams) {
  const { internalNumber, scenario, organizationId, createdBy, assignedTo, reviewer, ruleByCode } = params;
  const isBroken = scenario === "broken";

  const brand = isBroken ? "Quinta das Carvalhas" : "Tapada do Fidalgo";
  const packageCount = isBroken ? 900 : 800;
  const unitsPerPackage = 6;
  const unitCapacityLiters = 0.75;
  const correctVolume = packageCount * unitsPerPackage * unitCapacityLiters;
  const informedVolumeLiters = isBroken ? packageCount * unitCapacityLiters : correctVolume; // erro caixa x garrafa

  const dossier = await prisma.dossier.create({
    data: {
      organizationId,
      internalNumber,
      importerName: "BARRINHAS Comércio e Importação de Bebidas e Cereais Ltda.",
      exporterName: "Granacer - Administração de Bens, S.A.",
      producerName: "Granacer - Administração de Bens, S.A.",
      countryOrigin: "Portugal",
      productCategory: "vinho",
      productName: "Vinho Fino Tinto Seco",
      brand,
      vintage: "2025",
      geographicalIndication: "Regional Alentejano",
      batchNumber: "LVT25260101",
      packageType: "Caixas de 6 garrafas",
      packageCount,
      unitsPerPackage,
      unitCapacityLiters,
      informedVolumeLiters,
      calculatedVolumeLiters: correctVolume,
      status: "documentos_pendentes",
      assignedToId: assignedTo.id,
      createdById: createdBy.id,
    },
  });

  await logEvent(organizationId, dossier.id, createdBy.id, AUDIT_ACTIONS.DOSSIER_CREATED, "dossier", dossier.id, undefined, {
    internalNumber,
  });

  const dossierContext: DossierContext = {
    importerName: dossier.importerName,
    exporterName: dossier.exporterName,
    producerName: dossier.producerName,
    countryOrigin: dossier.countryOrigin,
    productName: dossier.productName,
    brand: dossier.brand,
    vintage: dossier.vintage,
    geographicalIndication: dossier.geographicalIndication,
    batchNumber: dossier.batchNumber,
    packageType: dossier.packageType,
    packageCount: dossier.packageCount,
    unitsPerPackage: dossier.unitsPerPackage,
    unitCapacityLiters: dossier.unitCapacityLiters,
    informedVolumeLiters: dossier.informedVolumeLiters,
  };

  // Overrides propositais para simular divergências reais entre documentos
  // no cenário "broken" — como se o OCR tivesse lido documentos físicos
  // diferentes entre si.
  const overridesByType: Partial<Record<DocumentType, Record<string, string | null>>> = isBroken
    ? {
        anexo_ix: { numero_laudo: null }, // RULE-003: laudo ausente no Anexo IX
        invoice: { marca: "Carvalhas" }, // RULE-004: divergência de marca
        packing_list: { marca: "Carvalhas" },
        rotulo: { marca: "Carvalhas" },
      }
    : {};

  const documentFieldSets: DocumentFieldSet[] = [];

  for (const documentType of DEMO_DOCUMENTS) {
    const filename = `${internalNumber}-${documentType}.pdf`;
    const document = await prisma.document.create({
      data: {
        organizationId,
        dossierId: dossier.id,
        documentType,
        filename,
        filePath: `/storage/uploads/seed/${internalNumber}/${filename}`,
        mimeType: "application/pdf",
        size: 180_000 + Math.floor(Math.random() * 40_000),
        checksum: syntheticChecksum(filename),
        uploadStatus: "enviado",
        extractionStatus: "concluida",
        uploadedById: createdBy.id,
      },
    });

    await logEvent(organizationId, dossier.id, createdBy.id, AUDIT_ACTIONS.DOCUMENT_UPLOADED, "document", document.id, undefined, {
      documentType,
      filename,
    });

    const extracted = await extractor.extract({
      documentType,
      filename,
      dossierContext,
      fieldOverrides: overridesByType[documentType],
    });

    const avgConfidence = extracted.length
      ? extracted.reduce((sum, f) => sum + f.confidence, 0) / extracted.length
      : null;

    await prisma.document.update({ where: { id: document.id }, data: { confidenceScore: avgConfidence } });

    await prisma.extractedField.createMany({
      data: extracted.map((f) => ({
        organizationId,
        dossierId: dossier.id,
        documentId: document.id,
        fieldKey: f.key,
        fieldLabel: f.key,
        fieldValue: f.value,
        normalizedValue: f.value.toUpperCase(),
        confidence: f.confidence,
      })),
    });

    await logEvent(organizationId, dossier.id, createdBy.id, AUDIT_ACTIONS.DOCUMENT_EXTRACTED, "document", document.id, undefined, {
      fieldsExtracted: extracted.length,
    });

    documentFieldSets.push({
      documentType,
      documentId: document.id,
      fields: Object.fromEntries(extracted.map((f) => [f.key, f.value])),
    });
  }

  // -------------------------------------------------------------------
  // Motor de regras
  // -------------------------------------------------------------------
  const engineResult = runRuleEngine({
    dossier: {
      brand: dossier.brand,
      productName: dossier.productName,
      vintage: dossier.vintage,
      geographicalIndication: dossier.geographicalIndication,
      batchNumber: dossier.batchNumber,
      packageCount: dossier.packageCount,
      unitsPerPackage: dossier.unitsPerPackage,
      unitCapacityLiters: dossier.unitCapacityLiters,
      informedVolumeLiters: dossier.informedVolumeLiters,
    },
    documents: documentFieldSets,
  });

  const validationRun = await prisma.validationRun.create({
    data: {
      organizationId,
      dossierId: dossier.id,
      status: "concluida",
      score: engineResult.score,
      rulesVersionSnapshot: JSON.stringify(RULE_DEFINITIONS.map((r) => ({ code: r.code, version: 1 }))),
      completedAt: now(),
      createdById: createdBy.id,
    },
  });

  await logEvent(organizationId, dossier.id, createdBy.id, AUDIT_ACTIONS.VALIDATION_RUN, "validation_run", validationRun.id, undefined, {
    score: engineResult.score,
    findings: engineResult.findings.length,
  });

  for (const finding of engineResult.findings) {
    const rule = ruleByCode.get(finding.ruleCode);
    if (!rule) continue;
    const alert = await prisma.validationAlert.create({
      data: {
        organizationId,
        dossierId: dossier.id,
        validationRunId: validationRun.id,
        ruleId: rule.id,
        severity: finding.severity,
        status: "aberto",
        title: finding.title,
        message: finding.message,
        recommendation: finding.recommendation,
        evidence: finding.evidence ? JSON.stringify(finding.evidence) : null,
      },
    });
    await logEvent(organizationId, dossier.id, createdBy.id, AUDIT_ACTIONS.ALERT_GENERATED, "validation_alert", alert.id, undefined, {
      severity: finding.severity,
      rule: finding.ruleCode,
    });
  }

  // -------------------------------------------------------------------
  // Estado final: no cenário limpo, simula fluxo completo até aprovação;
  // no cenário com erro, permanece em revisão com alertas críticos abertos.
  // -------------------------------------------------------------------
  if (!isBroken && reviewer) {
    const alerts = await prisma.validationAlert.findMany({ where: { dossierId: dossier.id } });
    for (const alert of alerts) {
      await prisma.validationAlert.update({
        where: { id: alert.id },
        data: {
          status: "resolvido",
          reviewedById: reviewer.id,
          confirmedById: reviewer.id,
          reviewComment: "Divergência textual explicada pela safra constar no rótulo. Revisado e aceito.",
        },
      });
      await logEvent(organizationId, dossier.id, reviewer.id, AUDIT_ACTIONS.ALERT_REVIEWED, "validation_alert", alert.id, { status: "aberto" }, { status: "resolvido" });
    }

    await prisma.dossier.update({
      where: { id: dossier.id },
      data: { status: "aprovado", complianceScore: engineResult.score },
    });
    await logEvent(organizationId, dossier.id, reviewer.id, AUDIT_ACTIONS.DOSSIER_APPROVED, "dossier", dossier.id, { status: "em_revisao" }, { status: "aprovado" });

    const report = await prisma.report.create({
      data: {
        organizationId,
        dossierId: dossier.id,
        validationRunId: validationRun.id,
        status: "aprovado",
        title: `Parecer de conformidade — ${internalNumber}`,
        summary: `Dossiê analisado sem inconsistências críticas. Score de conformidade: ${engineResult.score}/100 (Apto).`,
        generatedById: createdBy.id,
        approvedById: reviewer.id,
        approvedAt: now(),
      },
    });
    await logEvent(organizationId, dossier.id, reviewer.id, AUDIT_ACTIONS.REPORT_ISSUED, "report", report.id, undefined, { score: engineResult.score });
  } else {
    await prisma.dossier.update({
      where: { id: dossier.id },
      data: { status: "em_revisao", complianceScore: engineResult.score },
    });
  }

  console.log(
    `  ✓ Dossiê ${internalNumber} (${scenario}) — score ${engineResult.score}, ${engineResult.findings.length} alerta(s) gerado(s)`,
  );
}

async function logEvent(
  organizationId: string,
  dossierId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
) {
  await prisma.auditEvent.create({
    data: {
      organizationId,
      dossierId,
      userId,
      action,
      entityType,
      entityId,
      beforeJson: before !== undefined ? JSON.stringify(before) : null,
      afterJson: after !== undefined ? JSON.stringify(after) : null,
    },
  });
}

function syntheticChecksum(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `sha256-sim-${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
