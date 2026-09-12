"use server";

import { revalidatePath } from "next/cache";

import { logAuditEvent } from "@/lib/audit";
import type { Role } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/tenant";

type ActionResult<T = Record<string, unknown>> = ({ success: true } & T) | { success: false; error: string };

export async function updateMemberRole(memberId: string, role: Role): Promise<ActionResult> {
  const tenant = await requireRole(["admin"]);

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: tenant.organizationId },
  });
  if (!member) {
    return { success: false, error: "Usuário não encontrado nesta organização." };
  }
  if (member.userId === tenant.userId) {
    return { success: false, error: "Você não pode alterar o próprio papel." };
  }

  const updated = await prisma.organizationMember.update({ where: { id: memberId }, data: { role } });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    action: "papel_usuario_alterado",
    entityType: "organization_member",
    entityId: member.id,
    before: { role: member.role },
    after: { role: updated.role },
  });

  revalidatePath("/painel/admin");
  return { success: true };
}

export async function updateMemberStatus(
  memberId: string,
  status: "active" | "suspended",
): Promise<ActionResult> {
  const tenant = await requireRole(["admin"]);

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: tenant.organizationId },
  });
  if (!member) {
    return { success: false, error: "Usuário não encontrado nesta organização." };
  }
  if (member.userId === tenant.userId) {
    return { success: false, error: "Você não pode suspender o próprio acesso." };
  }

  const updated = await prisma.organizationMember.update({ where: { id: memberId }, data: { status } });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    action: "status_usuario_alterado",
    entityType: "organization_member",
    entityId: member.id,
    before: { status: member.status },
    after: { status: updated.status },
  });

  revalidatePath("/painel/admin");
  return { success: true };
}
