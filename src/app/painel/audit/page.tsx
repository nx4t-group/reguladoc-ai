import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/tenant";
import { PageHeader } from "@/components/layout/page-header";
import { AuditLogClient } from "./audit-client";

export default async function AuditPage() {
  const tenant = await requireRole(["admin", "gestor"]);

  const events = await prisma.auditEvent.findMany({
    where: { organizationId: tenant.organizationId },
    include: {
      user: { select: { name: true, email: true } },
      dossier: { select: { internalNumber: true, brand: true, productName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const formattedEvents = events.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    dossierInternalNumber: e.dossier?.internalNumber ?? null,
    dossierBrand: e.dossier?.brand ?? null,
    userName: e.user?.name ?? "Sistema / IA",
    userEmail: e.user?.email ?? null,
    ipAddress: e.ipAddress,
    createdAt: e.createdAt.toISOString(),
    beforeJson: e.beforeJson,
    afterJson: e.afterJson,
    metadataJson: e.metadataJson,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trilha de Auditoria & Governança"
        description="Registro imutável de todas as ações, decisões, extrações e alterações normativas realizadas no sistema."
      />
      <AuditLogClient events={formattedEvents} />
    </div>
  );
}
