import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

import { RulesTable } from "./rules-table";

export default async function RulesPage() {
  const tenant = await requireTenant();

  const [rules, dossierCount] = await Promise.all([
    prisma.validationRule.findMany({
      where: { OR: [{ organizationId: tenant.organizationId }, { organizationId: null }] },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    }),
    prisma.dossier.count({ where: { organizationId: tenant.organizationId } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Regras de validação"
        description="Motor de regras versionado: cada alteração gera uma nova versão auditável, preservando o histórico completo de vigência de cada regra."
      />
      <RulesTable rules={rules} hasDossierForSimulation={dossierCount > 0} />
    </div>
  );
}
