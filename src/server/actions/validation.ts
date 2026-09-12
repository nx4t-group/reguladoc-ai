"use server";

import { revalidatePath } from "next/cache";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import { MANDATORY_LEGAL_DISCLAIMER, scoreClassification, type DocumentType } from "@/lib/constants";
import { assertCapability } from "@/lib/permissions";
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
    itemId: doc.itemId,
    fields: Object.fromEntries(fields.filter((f) => f.documentId === doc.id).map((f) => [f.fieldKey, f.fieldValue])),
  }));
}

export async function runDossierValidation(dossierId: string): Promise<ActionResult<{ score: number; findings: number }>> {
  const tenant = await requireTenant();
  assertCapability(tenant.role, "DOSSIER_EDIT");

  const dossier = await prisma.dossier.findFirst({
    where: { id: dossierId, organizationId: tenant.organizationId },
    include: { items: true },
  });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  const documents = await buildDocumentFieldSets(dossierId);
  if (documents.length === 0) {
    return { ok: false, error: "Envie ao menos um documento antes de executar a validação." };
  }

  const rules = await prisma.validationRule.findMany({
    where: { OR: [{ organizationId: tenant.organizationId }, { organizationId: null }], status: "ativa" },
  });
  const activeDefinitions = RULE_DEFINITIONS.filter((def) => rules.some((r) => r.code === def.code));

  // Determina se está na fase de recebimento fracionado de documentos
  const isAwaiting = dossier.status === "rascunho" || dossier.status === "documentos_pendentes";

  // Obter ou criar snapshot regulatório imutável
  let snapshot = await prisma.regulatorySnapshot.findFirst({
    where: { code: "SNAPSHOT-DEFAULT-2026" },
  });
  if (!snapshot) {
    snapshot = await prisma.regulatorySnapshot.create({
      data: {
        code: "SNAPSHOT-DEFAULT-2026",
        name: "Normativa Geral de Bebidas - MAPA 2026",
        description: "Snapshot imutável de regras determinísticas e fontes normativas vigentes (IN 67/2022, Dec. 8.198/2014, Portaria 392/2021).",
        rulesData: JSON.stringify(
          RULE_DEFINITIONS.map((r) => ({
            code: r.code,
            name: r.name,
            category: r.category,
            severity: r.severity,
            sourceReference: r.sourceReference,
            version: 1,
          }))
        ),
      },
    });
  }

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
    isAwaitingDocuments: isAwaiting,
  });

  const validationRun = await prisma.validationRun.create({
    data: {
      organizationId: tenant.organizationId,
      dossierId,
      snapshotId: snapshot.id,
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
  const existingAlerts = await prisma.validationAlert.findMany({
    where: { dossierId, organizationId: tenant.organizationId },
  });
  const existingByRuleId = new Map(existingAlerts.map((a) => [a.ruleId, a]));
  const detectedRuleIds = new Set<string>();

  for (const finding of engineResult.findings) {
    const rule = ruleByCode.get(finding.ruleCode);
    if (!rule) continue;
    detectedRuleIds.add(rule.id);

    const existingAlert = existingByRuleId.get(rule.id);
    if (existingAlert) {
      // Se estava em aberto ou confirmado, atualiza evidência
      if (["aberto", "confirmado"].includes(existingAlert.status)) {
        await prisma.validationAlert.update({
          where: { id: existingAlert.id },
          data: {
            validationRunId: validationRun.id,
            evidence: finding.evidence ? JSON.stringify(finding.evidence) : null,
            message: finding.message,
            recommendation: finding.recommendation,
          },
        });
      }
    } else {
      // Alerta novo
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
  }

  // Se um alerta estava aberto mas o finding não foi mais detectado (ex: corrigido via substituição de arquivo), resolve
  for (const alert of existingAlerts) {
    if (alert.status === "aberto" && !detectedRuleIds.has(alert.ruleId)) {
      await prisma.validationAlert.update({
        where: { id: alert.id },
        data: {
          status: "resolvido",
          reviewComment: "Inconformidade superada automaticamente pela validação mais recente dos documentos.",
        },
      });
      await prisma.findingAction.create({
        data: {
          alertId: alert.id,
          userId: tenant.userId,
          actionType: "DOCUMENTO_SUBSTITUIDO",
          reason: "Inconformidade superada pela versão mais recente dos documentos enviados.",
          previousStatus: "aberto",
          newStatus: "resolvido",
        },
      });
    }
  }

  // Recalcula o status do dossiê no novo fluxo de decisão
  const activeBlockers = await prisma.validationAlert.count({
    where: {
      dossierId,
      status: { in: ["aberto", "confirmado"] },
      severity: { in: ["critica", "alta"] },
    },
  });

  let nextStatus = dossier.status;
  if (!["aprovado", "aprovado_com_ressalvas", "reprovado", "arquivado"].includes(dossier.status)) {
    if (isAwaiting) {
      nextStatus = "documentos_pendentes";
    } else if (activeBlockers > 0) {
      nextStatus = "em_revisao";
    } else {
      nextStatus = "em_revisao";
    }
  }

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

  // Automação: relatório emitido quando documentação obrigatória está presente
  const hasMissingDocuments = engineResult.findings.some((f) => f.ruleCode === "RULE-013");
  if (!hasMissingDocuments && !["aprovado", "aprovado_com_ressalvas", "reprovado", "arquivado"].includes(nextStatus)) {
    const classification = scoreClassification(engineResult.score);
    const report = await prisma.report.create({
      data: {
        organizationId: tenant.organizationId,
        dossierId,
        validationRunId: validationRun.id,
        status: "emitido",
        title: `Relatório de Conferência Documental Pré-Embarque — ${dossier.internalNumber}`,
        summary: `Score de conferência: ${engineResult.score}/100 (${classification.label}). ${MANDATORY_LEGAL_DISCLAIMER}`,
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
    revalidatePath("/painel/reports");
  }

  revalidatePath(`/painel/dossiers/${dossierId}`);
  revalidatePath(`/painel/dossiers/${dossierId}/review`);
  revalidatePath("/painel/dossiers");
  revalidatePath("/painel");

  return { ok: true, data: { score: engineResult.score, findings: engineResult.findings.length } };
}

