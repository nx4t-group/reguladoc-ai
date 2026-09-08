"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import { scoreClassification } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireRole, requireTenant } from "@/lib/tenant";
import type { ActionResult } from "./dossiers";

export async function generateReport(dossierId: string): Promise<ActionResult<{ id: string }>> {
  const tenant = await requireTenant();
  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };
  if (dossier.complianceScore == null) {
    return { ok: false, error: "Execute a validação antes de gerar o parecer." };
  }

  const lastRun = await prisma.validationRun.findFirst({ where: { dossierId }, orderBy: { startedAt: "desc" } });
  const classification = scoreClassification(dossier.complianceScore);

  const report = await prisma.report.create({
    data: {
      organizationId: tenant.organizationId,
      dossierId,
      validationRunId: lastRun?.id,
      status: "emitido",
      title: `Parecer de conformidade — ${dossier.internalNumber}`,
      summary: `Score de conformidade: ${dossier.complianceScore}/100 (${classification.label}). Documento gerado a partir da validação automática, sujeito a revisão humana obrigatória antes da aprovação final.`,
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
  // RULE-014: aprovação final exige papel de revisor humano (gestor/admin), nunca só a IA.
  const tenant = await requireRole(["admin", "gestor"]);
  const { dossierId, decision, comment } = approveSchema.parse(input);

  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  const openCritical = await prisma.validationAlert.count({
    where: { dossierId, severity: "critica", status: { in: ["aberto", "confirmado"] } },
  });
  if (decision !== "reprovado" && openCritical > 0) {
    return { ok: false, error: "Existem alertas críticos em aberto. Revise-os antes de aprovar o dossiê." };
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
