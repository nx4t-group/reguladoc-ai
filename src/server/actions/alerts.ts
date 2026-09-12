"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import { ALERT_STATUSES, ALERT_SEVERITIES, type AlertSeverity } from "@/lib/constants";
import { assertCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { scoreDossier } from "@/lib/rules/calculations";
import { requireTenant } from "@/lib/tenant";
import type { ActionResult } from "./dossiers";

const reviewAlertSchema = z.object({
  alertId: z.string(),
  status: z.enum(ALERT_STATUSES),
  severity: z.enum(ALERT_SEVERITIES).optional(),
  reviewComment: z.string().optional(),
});

export type ReviewAlertInput = z.infer<typeof reviewAlertSchema>;

async function recomputeDossierScore(dossierId: string, organizationId: string) {
  const activeAlerts = await prisma.validationAlert.findMany({
    where: {
      dossierId,
      organizationId,
      status: { in: ["aberto", "confirmado"] },
    },
    select: { severity: true },
  });
  const score = scoreDossier(activeAlerts.map((a) => ({ severity: a.severity as AlertSeverity })));
  await prisma.dossier.update({ where: { id: dossierId }, data: { complianceScore: score } });
  return score;
}

export async function reviewAlert(input: ReviewAlertInput): Promise<ActionResult<{ score: number }>> {
  const tenant = await requireTenant();
  const parsed = reviewAlertSchema.parse(input);

  // RBAC por capability
  if (parsed.severity) {
    assertCapability(tenant.role, "FINDING_RECLASSIFY");
  } else {
    assertCapability(tenant.role, "FINDING_RESOLVE");
  }

  // Justificativa obrigatória para resoluções ou falsos positivos
  if (["falso_positivo", "resolvido"].includes(parsed.status)) {
    if (!parsed.reviewComment || parsed.reviewComment.trim().length < 5) {
      return { ok: false, error: "Justificativa técnica obrigatória (mínimo de 5 caracteres) para resolver ou marcar como falso positivo." };
    }
  }

  const alert = await prisma.validationAlert.findFirst({
    where: { id: parsed.alertId, organizationId: tenant.organizationId },
  });
  if (!alert) return { ok: false, error: "Inconformidade não encontrada." };

  await prisma.validationAlert.update({
    where: { id: parsed.alertId },
    data: {
      status: parsed.status,
      severity: parsed.severity ?? alert.severity,
      reviewComment: parsed.reviewComment ?? alert.reviewComment,
      reviewedById: tenant.userId,
      confirmedById: parsed.status === "confirmado" ? tenant.userId : alert.confirmedById,
    },
  });

  // Registra no histórico de ações de finding
  await prisma.findingAction.create({
    data: {
      alertId: parsed.alertId,
      userId: tenant.userId,
      actionType: parsed.status === "falso_positivo" ? "FALSO_POSITIVO" : parsed.status === "confirmado" ? "CONFIRMAR" : "JUSTIFICATIVA_TECNICA",
      reason: parsed.reviewComment || "Status atualizado pelo analista/gestor",
      previousStatus: alert.status,
      newStatus: parsed.status,
    },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId: alert.dossierId,
    action: AUDIT_ACTIONS.ALERT_REVIEWED,
    entityType: "validation_alert",
    entityId: alert.id,
    before: { status: alert.status, severity: alert.severity },
    after: { status: parsed.status, severity: parsed.severity ?? alert.severity, comment: parsed.reviewComment },
  });

  const score = await recomputeDossierScore(alert.dossierId, tenant.organizationId);

  revalidatePath(`/painel/dossiers/${alert.dossierId}`);
  revalidatePath(`/painel/dossiers/${alert.dossierId}/review`);
  revalidatePath("/painel/dossiers");
  revalidatePath("/painel");

  return { ok: true, data: { score } };
}

const recordFindingActionSchema = z.object({
  alertId: z.string(),
  actionType: z.enum([
    "CONFIRMAR",
    "FALSO_POSITIVO",
    "AGUARDANDO_DOCUMENTO",
    "DOCUMENTO_SUBSTITUIDO",
    "JUSTIFICATIVA_TECNICA",
    "ESCALAR_GESTOR",
  ]),
  reason: z.string().min(5, "A justificativa técnica deve ter pelo menos 5 caracteres"),
});

export type RecordFindingActionInput = z.infer<typeof recordFindingActionSchema>;

export async function recordFindingAction(input: RecordFindingActionInput): Promise<ActionResult<{ score: number }>> {
  const tenant = await requireTenant();
  assertCapability(tenant.role, "FINDING_RESOLVE");

  const parsed = recordFindingActionSchema.parse(input);

  const alert = await prisma.validationAlert.findFirst({
    where: { id: parsed.alertId, organizationId: tenant.organizationId },
  });
  if (!alert) return { ok: false, error: "Inconformidade não encontrada." };

  let newStatus = alert.status;
  if (parsed.actionType === "CONFIRMAR") newStatus = "confirmado";
  else if (parsed.actionType === "FALSO_POSITIVO") newStatus = "falso_positivo";
  else if (parsed.actionType === "JUSTIFICATIVA_TECNICA" || parsed.actionType === "DOCUMENTO_SUBSTITUIDO") newStatus = "resolvido";
  else if (parsed.actionType === "AGUARDANDO_DOCUMENTO") newStatus = "aberto";

  // Se a ação for aguardar documento complementar, move o dossiê para documentos_pendentes
  if (parsed.actionType === "AGUARDANDO_DOCUMENTO") {
    await prisma.dossier.update({
      where: { id: alert.dossierId },
      data: { status: "documentos_pendentes" },
    });
  }

  await prisma.findingAction.create({
    data: {
      alertId: alert.id,
      userId: tenant.userId,
      actionType: parsed.actionType,
      reason: parsed.reason,
      previousStatus: alert.status,
      newStatus,
    },
  });

  await prisma.validationAlert.update({
    where: { id: alert.id },
    data: {
      status: newStatus,
      reviewedById: tenant.userId,
      reviewComment: parsed.reason,
    },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId: alert.dossierId,
    action: AUDIT_ACTIONS.ALERT_REVIEWED,
    entityType: "validation_alert",
    entityId: alert.id,
    after: { actionType: parsed.actionType, newStatus, reason: parsed.reason },
  });

  const score = await recomputeDossierScore(alert.dossierId, tenant.organizationId);

  revalidatePath(`/painel/dossiers/${alert.dossierId}`);
  revalidatePath(`/painel/dossiers/${alert.dossierId}/review`);
  revalidatePath("/painel/dossiers");
  revalidatePath("/painel");

  return { ok: true, data: { score } };
}

export async function requestComplementaryDocument(alertId: string, reason?: string): Promise<ActionResult> {
  const tenant = await requireTenant();
  assertCapability(tenant.role, "FINDING_RESOLVE");

  const alert = await prisma.validationAlert.findFirst({
    where: { id: alertId, organizationId: tenant.organizationId },
  });
  if (!alert) return { ok: false, error: "Inconformidade não encontrada." };

  const justification = reason || "Solicitação de novo documento ou versão retificada para sanar pendência regulatória";

  await prisma.dossier.update({
    where: { id: alert.dossierId },
    data: { status: "documentos_pendentes" },
  });

  await prisma.validationAlert.update({
    where: { id: alert.id },
    data: {
      status: "aberto",
      reviewComment: `Aguardando novo documento: ${justification}`,
      reviewedById: tenant.userId,
    },
  });

  await prisma.findingAction.create({
    data: {
      alertId: alert.id,
      userId: tenant.userId,
      actionType: "AGUARDANDO_DOCUMENTO",
      reason: justification,
      previousStatus: alert.status,
      newStatus: "aberto",
    },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId: alert.dossierId,
    action: AUDIT_ACTIONS.DOSSIER_STATUS_CHANGED,
    entityType: "dossier",
    entityId: alert.dossierId,
    after: { status: "documentos_pendentes", reason: justification },
  });

  revalidatePath(`/painel/dossiers/${alert.dossierId}`);
  return { ok: true };
}
