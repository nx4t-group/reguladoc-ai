"use server";

import { revalidatePath } from "next/cache";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import { scoreClassification, type DocumentType } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { DocumentFieldSet } from "@/lib/rules/calculations";
import { RULE_DEFINITIONS } from "@/lib/rules/definitions";
import { runRuleEngine } from "@/lib/rules/engine";
import { requireTenant } from "@/lib/tenant";
import type { ActionResult } from "./dossiers";

export async function buildDocumentFieldSets(dossierId: string): Promise<DocumentFieldSet[]> {
  const [documents, fields] = await Promise.all([
    prisma.document.findMany({ where: { dossierId } }),
    prisma.extractedField.findMany({ where: { dossierId } }),
  ]);

  return documents.map((doc) => ({
    documentType: doc.documentType as DocumentType,
    documentId: doc.id,
    fields: Object.fromEntries(fields.filter((f) => f.documentId === doc.id).map((f) => [f.fieldKey, f.fieldValue])),
  }));
}

export async function runDossierValidation(dossierId: string): Promise<ActionResult<{ score: number; findings: number }>> {
  const tenant = await requireTenant();
  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  const documents = await buildDocumentFieldSets(dossierId);
  if (documents.length === 0) {
    return { ok: false, error: "Envie ao menos um documento antes de executar a validação." };
  }

  const rules = await prisma.validationRule.findMany({
    where: { OR: [{ organizationId: tenant.organizationId }, { organizationId: null }], status: "ativa" },
  });
  const activeDefinitions = RULE_DEFINITIONS.filter((def) => rules.some((r) => r.code === def.code));

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
    documents,
    rules: activeDefinitions.length > 0 ? activeDefinitions : RULE_DEFINITIONS,
  });

  const validationRun = await prisma.validationRun.create({
    data: {
      organizationId: tenant.organizationId,
      dossierId,
      status: "concluida",
      score: engineResult.score,
      rulesVersionSnapshot: JSON.stringify(
        rules.length > 0 ? rules.map((r) => ({ code: r.code, version: r.version })) : engineResult.rulesVersionSnapshot,
      ),
      completedAt: new Date(),
      createdById: tenant.userId,
    },
  });

  const ruleByCode = new Map(rules.map((r) => [r.code, r]));
  for (const finding of engineResult.findings) {
    const rule = ruleByCode.get(finding.ruleCode);
    if (!rule) continue;
    const alert = await prisma.validationAlert.create({
      data: {
        organizationId: tenant.organizationId,
        dossierId,
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
    await logAuditEvent({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      dossierId,
      action: AUDIT_ACTIONS.ALERT_GENERATED,
      entityType: "validation_alert",
      entityId: alert.id,
      after: { severity: finding.severity, rule: finding.ruleCode },
    });
  }

  const nextStatus = ["aprovado", "aprovado_com_ressalvas", "reprovado", "arquivado"].includes(dossier.status)
    ? dossier.status
    : "em_revisao";

  await prisma.dossier.update({
    where: { id: dossierId },
    data: { complianceScore: engineResult.score, status: nextStatus },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId,
    action: AUDIT_ACTIONS.VALIDATION_RUN,
    entityType: "validation_run",
    entityId: validationRun.id,
    after: { score: engineResult.score, findings: engineResult.findings.length },
  });

  // Automação: assim que a documentação obrigatória está completa (nenhum
  // achado de RULE-013) e o dossiê ainda não tem uma decisão final, emite o
  // parecer automaticamente para esta execução — evita gerar um parecer a
  // cada upload individual de um dossiê ainda incompleto.
  const hasMissingDocuments = engineResult.findings.some((f) => f.ruleCode === "RULE-013");
  if (!hasMissingDocuments && nextStatus !== "aprovado" && nextStatus !== "aprovado_com_ressalvas" && nextStatus !== "reprovado" && nextStatus !== "arquivado") {
    const classification = scoreClassification(engineResult.score);
    const report = await prisma.report.create({
      data: {
        organizationId: tenant.organizationId,
        dossierId,
        validationRunId: validationRun.id,
        status: "emitido",
        title: `Parecer de conformidade — ${dossier.internalNumber}`,
        summary: `Score de conformidade: ${engineResult.score}/100 (${classification.label}). Parecer gerado automaticamente após validação com toda a documentação obrigatória presente — sujeito a revisão humana obrigatória antes da aprovação final.`,
        generatedById: tenant.userId,
      },
    });
    await logAuditEvent({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      dossierId,
      action: AUDIT_ACTIONS.REPORT_GENERATED,
      entityType: "report",
      entityId: report.id,
      after: { score: engineResult.score, classification: classification.label, automatic: true },
    });
    revalidatePath("/app/reports");
  }

  revalidatePath(`/app/dossiers/${dossierId}`);
  revalidatePath(`/app/dossiers/${dossierId}/review`);
  revalidatePath("/app/dossiers");
  revalidatePath("/app");

  return { ok: true, data: { score: engineResult.score, findings: engineResult.findings.length } };
}
