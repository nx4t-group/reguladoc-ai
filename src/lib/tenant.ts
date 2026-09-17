import { getServerSession, type Session } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import type { Role } from "@/lib/constants";

/**
 * Camada de isolamento multi-tenant "aplicativa": como o MVP roda em SQLite
 * (sem RLS nativo do Postgres), todo acesso a dados passa por aqui, que
 * resolve a sessão e devolve `organizationId` para ser usado em todo `where`
 * de consulta/mutação Prisma. Ver SECURITY.md para o plano de migração para
 * Supabase Postgres + RLS nativo.
 */
export async function getCurrentSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

export interface TenantContext {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

/** Exige sessão autenticada; redireciona para /login quando ausente. */
export async function requireTenant(): Promise<TenantContext> {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect("/login");
  }
  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    organizationName: (session.user.organizationName ?? "").replace(/demo/gi, "Teste"),
    role: session.user.role,
    name: (session.user.name ?? "").replace(/demo/gi, "Teste"),
    email: session.user.email ?? "",
    avatarUrl: session.user.image ?? null,
  };
}

/** Exige que o papel do usuário esteja entre os permitidos; redireciona para /app caso contrário. */
export async function requireRole(allowed: Role[]): Promise<TenantContext> {
  const tenant = await requireTenant();
  if (!allowed.includes(tenant.role)) {
    redirect("/painel");
  }
  return tenant;
}
