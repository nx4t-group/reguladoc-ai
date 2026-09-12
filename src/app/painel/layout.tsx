import { PLAN_LABELS, type Plan } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar, type TopbarNotification } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();

  const [organization, criticalAlerts] = await Promise.all([
    prisma.organization.findUnique({ where: { id: tenant.organizationId } }),
    prisma.validationAlert.findMany({
      where: { organizationId: tenant.organizationId, severity: "critica", status: "aberto" },
      include: { dossier: { select: { internalNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const notifications: TopbarNotification[] = criticalAlerts.map((alert) => ({
    id: alert.id,
    title: alert.title,
    dossierId: alert.dossierId,
    dossierInternalNumber: alert.dossier.internalNumber,
    severity: alert.severity as TopbarNotification["severity"],
  }));

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="no-print contents">
        <Sidebar role={tenant.role} planLabel={PLAN_LABELS[(organization?.plan ?? "starter") as Plan]} />
      </div>
      <div className="flex min-h-screen flex-col lg:pl-64">
        <div className="no-print contents">
          <Topbar
            name={tenant.name}
            email={tenant.email}
            role={tenant.role}
            organizationName={tenant.organizationName}
            notifications={notifications}
          />
        </div>
        <main className="flex-1 px-6 py-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
