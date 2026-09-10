"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import { MANDATORY_LEGAL_DISCLAIMER, scoreClassification } from "@/lib/constants";
import { assertCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import type { ActionResult } from "./dossiers";

export async function generateReport(dossierId: string): Promise<ActionResult<{ id: string }>> {
  const tenant = await requireTenant();
  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };
  if (dossier.complianceScore == null) {
    return { ok: false, error: "Execute a validação antes de gerar o relatório." };
  }

  const lastRun = await prisma.validationRun.findFirst({ where: { dossierId }, orderBy: { startedAt: "desc" } });
  const classification = scoreClassification(dossier.complianceScore);

  const report = await prisma.report.create({
    data: {
      organizationId: tenant.organizationId,
      dossierId,
      validationRunId: lastRun?.id,
      status: "emitido",
      title: `Relatório de Conferência Documental Pré-Embarque — ${dossier.internalNumber}`,
      summary: `Score de conferência documental: ${dossier.complianceScore}/100 (${classification.label}). ${MANDATORY_LEGAL_DISCLAIMER}`,
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
    after: { score: dossier.complianceScore, classification: classification.label },
  });

  revalidatePath(`/app/dossiers/${dossierId}`);
  revalidatePath("/app/reports");
  return { ok: true, data: { id: report.id } };
}

const approveSchema = z.object({
  dossierId: z.string(),
  decision: z.enum(["aprovado", "aprovado_com_ressalvas", "reprovado"]),
  comment: z.string().optional(),
});

export async function decideDossier(input: z.infer<typeof approveSchema>): Promise<ActionResult> {
  const tenant = await requireTenant();
  // RULE-014: decisão final de liberação exige permissão de revisor humano qualificado (gestor/admin)
  assertCapability(tenant.role, "DOSSIER_APPROVE");

  const { dossierId, decision, comment } = approveSchema.parse(input);

  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  // Bloqueio rigoroso: Não permite liberação se houver inconformidades críticas ou de alta severidade não resolvidas
  const openCriticalOrHigh = await prisma.validationAlert.count({
    where: {
      dossierId,
      severity: { in: ["critica", "alta"] },
      status: { in: ["aberto", "confirmado"] },
    },
  });

  if (decision !== "reprovado" && openCriticalOrHigh > 0) {
    return {
      ok: false,
      error: `Existem ${openCriticalOrHigh} inconformidade(s) crítica(s) ou de alta severidade em aberto. Todas devem ser resolvidas ou justificadas tecnicamente antes da liberação pré-embarque.`,
    };
  }

  await prisma.dossier.update({ where: { id: dossierId }, data: { status: decision } });

  const latestReport = await prisma.report.findFirst({ where: { dossierId }, orderBy: { generatedAt: "desc" } });
  if (latestReport) {
    await prisma.report.update({
      where: { id: latestReport.id },
      data: { status: "aprovado", approvedById: tenant.userId, approvedAt: new Date() },
    });
  }

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId,
    action: decision === "reprovado" ? AUDIT_ACTIONS.DOSSIER_REJECTED : AUDIT_ACTIONS.DOSSIER_APPROVED,
    entityType: "dossier",
    entityId: dossierId,
    before: { status: dossier.status },
    after: { status: decision, comment, reviewedBy: tenant.userId },
  });

  revalidatePath(`/app/dossiers/${dossierId}`);
  revalidatePath("/app/dossiers");
  revalidatePath("/app/reports");
  revalidatePath("/app");
  return { ok: true };
}

