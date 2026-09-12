"use server";

import { revalidatePath } from "next/cache";

import { logAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/tenant";

type ActionResult<T = Record<string, unknown>> = ({ success: true } & T) | { success: false; error: string };

export interface UpdateOrganizationSettingsInput {
  name: string;
  cnpj?: string;
  retentionDays: number;
}

/** Restrito a admin/gestor — analistas têm apenas leitura desta tela. */
export async function updateOrganizationSettings(
  input: UpdateOrganizationSettingsInput,
): Promise<ActionResult> {
  const tenant = await requireRole(["admin", "gestor"]);

  const before = await prisma.organization.findUnique({ where: { id: tenant.organizationId } });
  if (!before) {
    return { success: false, error: "Organização não encontrada." };
  }

  const updated = await prisma.organization.update({
    where: { id: tenant.organizationId },
    data: {
      name: input.name,
      cnpj: input.cnpj?.trim() ? input.cnpj.trim() : null,
      retentionDays: input.retentionDays,
    },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    action: "configuracoes_organizacao_atualizadas",
    entityType: "organization",
    entityId: tenant.organizationId,
    before: { name: before.name, cnpj: before.cnpj, retentionDays: before.retentionDays },
    after: { name: updated.name, cnpj: updated.cnpj, retentionDays: updated.retentionDays },
  });

  revalidatePath("/painel/settings");
  return { success: true };
}
