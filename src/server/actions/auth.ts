"use server";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit";

export interface RegisterOrganizationInput {
  organizationName: string;
  cnpj?: string;
  userName: string;
  email: string;
  password: string;
}

export interface RegisterOrganizationResult {
  ok: boolean;
  error?: string;
}

/**
 * Onboarding: cria a organização, o primeiro usuário (papel admin) e o
 * vínculo entre eles. Não autentica automaticamente — o cliente deve chamar
 * `signIn("credentials", ...)` em seguida com as mesmas credenciais.
 */
export async function registerOrganization(input: RegisterOrganizationInput): Promise<RegisterOrganizationResult> {
  const email = input.email.toLowerCase().trim();

  const existing = await prisma.profile.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Já existe uma conta com este e-mail." };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const organization = await prisma.organization.create({
    data: { name: input.organizationName, cnpj: input.cnpj || null, plan: "starter" },
  });

  const profile = await prisma.profile.create({
    data: { name: input.userName, email, passwordHash },
  });

  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: profile.id, role: "admin" },
  });

  await logAuditEvent({
    organizationId: organization.id,
    userId: profile.id,
    action: "organizacao_criada",
    entityType: "organization",
    entityId: organization.id,
    after: { name: organization.name },
  });

  return { ok: true };
}
