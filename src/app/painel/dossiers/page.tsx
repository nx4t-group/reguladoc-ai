import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { DossiersTable, type DossierRow } from "./dossiers-table";

export default async function DossiersPage() {
  const tenant = await requireTenant();

  const dossiers = await prisma.dossier.findMany({
    where: { organizationId: tenant.organizationId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      assignedTo: { select: { name: true } },
      _count: { select: { alerts: { where: { severity: "critica", status: { in: ["aberto", "confirmado"] } } } } },
    },
  });

  const rows: DossierRow[] = dossiers.map((d) => ({
    id: d.id,
    internalNumber: d.internalNumber,
    importerName: d.importerName,
    productName: d.productName,
    brand: d.brand,
    batchNumber: d.batchNumber,
    countryOrigin: d.countryOrigin,
    status: d.status,
    complianceScore: d.complianceScore,
    criticalAlerts: d._count.alerts,
    assignedToName: d.assignedTo?.name ?? null,
    updatedAt: d.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dossiês"
        description="Todos os processos de importação em análise pela sua organização."
        actions={
          <Button asChild>
            <Link href="/painel/dossiers/new">
              <Plus className="h-4 w-4" /> Novo dossiê
            </Link>
          </Button>
        }
      />
      <DossiersTable data={rows} />
    </div>
  );
}
