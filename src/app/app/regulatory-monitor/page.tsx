import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

import { RegulatoryMonitorClient } from "./regulatory-monitor-client";

const STATUS_PRIORITY: Record<string, number> = {
  novo: 0,
  em_analise: 1,
  aprovado: 2,
  rejeitado: 3,
  convertido_em_regra: 3,
};

export default async function RegulatoryMonitorPage() {
  const tenant = await requireTenant();

  const [sources, items] = await Promise.all([
    prisma.regulatorySource.findMany({
      where: { OR: [{ organizationId: tenant.organizationId }, { organizationId: null }] },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.regulatoryItem.findMany({
      where: { OR: [{ organizationId: tenant.organizationId }, { organizationId: null }] },
      include: { source: { select: { name: true } } },
      orderBy: { capturedAt: "desc" },
    }),
  ]);

  const sortedItems = [...items].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 9;
    const pb = STATUS_PRIORITY[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    return b.capturedAt.getTime() - a.capturedAt.getTime();
  });

  return (
    <div>
      <PageHeader
        title="Monitor Regulatório"
        description="Publicações regulatórias sobre importação de bebidas não são centralizadas: o MAPA/Defesa Agropecuária é o principal canal, mas Instruções Normativas, Resoluções e Portarias podem aparecer primeiro no Diário Oficial ou em outras fontes."
      />
      <RegulatoryMonitorClient sources={sources} items={sortedItems} currentUserId={tenant.userId} />
    </div>
  );
}
