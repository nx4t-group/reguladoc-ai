"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import { ALERT_STATUSES, ALERT_SEVERITIES, type AlertSeverity } from "@/lib/constants";
import { scoreDossier } from "@/lib/rules/calculations";
import { prisma } from "@/lib/prisma";
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

  const alert = await prisma.validationAlert.findFirst({
    where: { id: parsed.alertId, organizationId: tenant.organizationId },
  });
  if (!alert) return { ok: false, error: "Alerta não encontrado." };

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

  revalidatePath(`/app/dossiers/${alert.dossierId}`);
  revalidatePath(`/app/dossiers/${alert.dossierId}/review`);
  revalidatePath("/app/dossiers");
  revalidatePath("/app");

  return { ok: true, data: { score } };
}

export async function requestComplementaryDocument(alertId: string): Promise<ActionResult> {
  const tenant = await requireTenant();
  const alert = await prisma.validationAlert.findFirst({ where: { id: alertId, organizationId: tenant.organizationId } });
  if (!alert) return { ok: false, error: "Alerta não encontrado." };

  await prisma.dossier.update({ where: { id: alert.dossierId }, data: { status: "documentos_pendentes" } });
  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId: alert.dossierId,
    action: AUDIT_ACTIONS.DOSSIER_STATUS_CHANGED,
    entityType: "dossier",
    entityId: alert.dossierId,
    after: { status: "documentos_pendentes", reason: `Documento complementar solicitado para alerta "${alert.title}"` },
  });

  revalidatePath(`/app/dossiers/${alert.dossierId}`);
  return { ok: true };
}

export async function generateAlertVariations(dossierId: string): Promise<ActionResult> {
  const tenant = await requireTenant();
  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  // Encontra ou cria uma ValidationRun para associar os alertas
  let lastRun = await prisma.validationRun.findFirst({
    where: { dossierId, organizationId: tenant.organizationId },
    orderBy: { startedAt: "desc" },
  });

  if (!lastRun) {
    lastRun = await prisma.validationRun.create({
      data: {
        organizationId: tenant.organizationId,
        dossierId,
        status: "concluida",
        score: 100,
        rulesVersionSnapshot: "[]",
        completedAt: new Date(),
        createdById: tenant.userId,
      },
    });
  }

  // Busca regras ativas ou globais
  const rules = await prisma.validationRule.findMany({
    where: { OR: [{ organizationId: tenant.organizationId }, { organizationId: null }], status: "ativa" },
  });

  const variations = [
    {
      severity: "critica",
      title: "[Simulação] Inconsistência Crítica de Lote",
      message: "O número do lote diverge de forma grave entre o Certificado de Origem e a Invoice de importação.",
      recommendation: "Solicitar correção formal dos documentos de importação junto ao exportador.",
      ruleCode: "RULE-002",
    },
    {
      severity: "alta",
      title: "[Simulação] Divergência de Marca Identificada",
      message: "A marca descrita na Invoice é 'Gran Tapada' enquanto o Rótulo menciona apenas 'Tapada'.",
      recommendation: "Verificar se a safra compensa a divergência textual ou corrigir grafia na Invoice.",
      ruleCode: "RULE-004",
    },
    {
      severity: "media",
      title: "[Simulação] Parâmetro de Acreditação em Ressalva",
      message: "O laudo de análise informa que o teor alcoólico foi medido sob metodologia fora do escopo do laboratório.",
      recommendation: "Revisar metodologia e atestar se está de acordo com as normas complementares.",
      ruleCode: "RULE-011",
    },
    {
      severity: "baixa",
      title: "[Simulação] Documentação Acessória Desatualizada",
      message: "A declaração de conformidade da embalagem foi emitida há mais de 365 dias.",
      recommendation: "Recomenda-se solicitar nova versão da declaração atualizada pelo produtor.",
      ruleCode: "RULE-013",
    },
    {
      severity: "informativa",
      title: "[Simulação] Análise de Rastreabilidade Concluída",
      message: "Fluxo de rastreabilidade de volume executado sem ressalvas complementares de pesagem.",
      recommendation: "Nenhuma ação necessária.",
      ruleCode: "RULE-015",
    },
  ];

  for (const item of variations) {
    const matchedRule = rules.find((r) => r.code === item.ruleCode);
    if (!matchedRule) continue;

    // Remove alerta idêntico pré-existente para evitar duplicados
    await prisma.validationAlert.deleteMany({
      where: {
        dossierId,
        organizationId: tenant.organizationId,
        title: item.title,
      }
    });

    await prisma.validationAlert.create({
      data: {
        organizationId: tenant.organizationId,
        dossierId,
        validationRunId: lastRun.id,
        ruleId: matchedRule.id,
        severity: item.severity,
        status: "aberto",
        title: item.title,
        message: item.message,
        recommendation: item.recommendation,
      },
    });

    await logAuditEvent({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      dossierId,
      action: AUDIT_ACTIONS.ALERT_GENERATED,
      entityType: "validation_alert",
      entityId: "simulated-alert",
      after: { severity: item.severity, rule: item.ruleCode, simulated: true },
    });
  }

  // Recalcula o score
  await recomputeDossierScore(dossierId, tenant.organizationId);

  // Atualiza status do dossiê para em revisão se necessário
  if (!["aprovado", "aprovado_com_ressalvas", "reprovado", "arquivado"].includes(dossier.status)) {
    await prisma.dossier.update({
      where: { id: dossierId },
      data: { status: "em_revisao" },
    });
  }

  revalidatePath(`/app/dossiers/${dossierId}`);
  revalidatePath(`/app/dossiers/${dossierId}/review`);
  revalidatePath("/app/dossiers");
  revalidatePath("/app");

  return { ok: true };
}
