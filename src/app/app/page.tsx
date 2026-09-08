import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileStack, Gauge, ListTodo, Newspaper, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { DossierStatusBadge } from "@/components/domain/status-badge";
import { AlertsBySeverityChart, DossiersByStatusChart } from "@/components/dashboard/charts";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ALERT_SEVERITIES, DOSSIER_STATUSES, type AlertSeverity, type DossierStatus } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { isExtractionSimulated } from "@/lib/extraction/service";

export default async function DashboardPage() {
  const tenant = await requireTenant();
  const organizationId = tenant.organizationId;
  const simulated = isExtractionSimulated();

  const [
    totalDossiers,
    emAnalise,
    aprovados,
    dossiersByStatusRaw,
    openAlertsBySeverityRaw,
    recentDossiers,
    newRegulatoryItems,
    criticalDossiers,
    finishedDossiers,
  ] = await Promise.all([
    prisma.dossier.count({ where: { organizationId, deletedAt: null } }),
    prisma.dossier.count({ where: { organizationId, deletedAt: null, status: { in: ["processando", "em_revisao"] } } }),
    prisma.dossier.count({ where: { organizationId, deletedAt: null, status: { in: ["aprovado", "aprovado_com_ressalvas"] } } }),
    prisma.dossier.groupBy({ by: ["status"], where: { organizationId, deletedAt: null }, _count: { _all: true } }),
    prisma.validationAlert.groupBy({ by: ["severity"], where: { organizationId, status: "aberto" }, _count: { _all: true } }),
    prisma.dossier.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, internalNumber: true, brand: true, productName: true, status: true, complianceScore: true, updatedAt: true },
    }),
    prisma.regulatoryItem.findMany({
      where: { OR: [{ organizationId }, { organizationId: null }], status: "novo" },
      orderBy: { capturedAt: "desc" },
      take: 4,
      include: { source: { select: { name: true } } },
    }),
    prisma.dossier.findMany({
      where: { organizationId, deletedAt: null, alerts: { some: { severity: "critica", status: "aberto" } } },
      select: {
        id: true,
        internalNumber: true,
        brand: true,
        _count: { select: { alerts: { where: { severity: "critica", status: "aberto" } } } },
      },
      take: 3,
    }),
    prisma.dossier.findMany({
      where: { organizationId, deletedAt: null, status: { in: ["aprovado", "aprovado_com_ressalvas", "reprovado"] } },
      select: { createdAt: true, updatedAt: true },
    }),
  ]);

  const dossiersByStatus: { status: DossierStatus; count: number }[] = DOSSIER_STATUSES.map((status) => ({
    status,
    count: dossiersByStatusRaw.find((d) => d.status === status)?._count._all ?? 0,
  }));

  const alertsBySeverity: { severity: AlertSeverity; count: number }[] = ALERT_SEVERITIES.map((severity) => ({
    severity,
    count: openAlertsBySeverityRaw.find((a) => a.severity === severity)?._count._all ?? 0,
  }));

  const dossiersWithAnyAlert = await prisma.dossier.count({
    where: { organizationId, deletedAt: null, alerts: { some: {} } },
  });
  const validatedDossiers = await prisma.dossier.count({
    where: { organizationId, deletedAt: null, validationRuns: { some: {} } },
  });
  const inconsistencyRate = validatedDossiers > 0 ? Math.round((dossiersWithAnyAlert / validatedDossiers) * 100) : 0;

  // Tarefas pendentes: dossiês parados aguardando documento ou revisão, mais antigos primeiro.
  const pendingTaskDossiers = await prisma.dossier.findMany({
    where: { organizationId, deletedAt: null, status: { in: ["documentos_pendentes", "em_revisao"] } },
    orderBy: { updatedAt: "asc" },
    take: 5,
    select: { id: true, internalNumber: true, brand: true, status: true, updatedAt: true },
  });

  const avgAnalysisDays =
    finishedDossiers.length > 0
      ? finishedDossiers.reduce((sum, d) => sum + (d.updatedAt.getTime() - d.createdAt.getTime()), 0) /
        finishedDossiers.length /
        (1000 * 60 * 60 * 24)
      : null;

  const criticalPendingCount = criticalDossiers.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bem-vindo(a), ${tenant.name.split(" ")[0]}`}
        description={`${tenant.organizationName} · Painel executivo de conformidade documental`}
        actions={
          <Button asChild>
            <Link href="/app/dossiers/new">Novo dossiê</Link>
          </Button>
        }
      />

      {simulated ? (
        <Card className="border-status-warning/20 bg-status-warning/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-status-warning text-white">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Status operacional: Modo Simulado Ativo</p>
                <p className="text-xs text-muted-foreground">
                  A extração documental e o motor de IA estão operando com respostas simuladas (mock). Insira uma{" "}
                  <code>GEMINI_API_KEY</code> no arquivo <code>.env</code> para habilitar o OCR real e a extração automatizada. Ver{" "}
                  <Link href="/app/security" className="underline underline-offset-2 font-medium">
                    Segurança e Governança
                  </Link>
                  .
                </p>
              </div>
            </div>
            <Badge variant="warning">Simulação</Badge>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-status-success/20 bg-status-success/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-status-success text-white">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Status operacional: Conectado ao Google Gemini OCR</p>
                <p className="text-xs text-muted-foreground">
                  O motor de inteligência artificial real está ativo e processará todos os uploads de documentos (PDF, PNG e JPG) extraindo dados via multimodal diretamente.
                </p>
              </div>
            </div>
            <Badge variant="success">Gemini OCR Ativo</Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total de dossiês" value={totalDossiers} icon={FileStack} />
        <KpiCard label="Em análise" value={emAnalise} icon={Clock} tone="warning" />
        <KpiCard label="Pendência crítica" value={criticalPendingCount} icon={ShieldAlert} tone="danger" />
        <KpiCard label="Aprovados" value={aprovados} icon={CheckCircle2} tone="success" />
        <KpiCard
          label="Tempo médio de análise"
          value={avgAnalysisDays == null ? "—" : avgAnalysisDays < 1 ? "< 1 dia" : `${avgAnalysisDays.toFixed(1)} dias`}
          icon={Clock}
        />
        <KpiCard label="Taxa de inconsistência" value={`${inconsistencyRate}%`} icon={AlertTriangle} tone={inconsistencyRate > 30 ? "danger" : "default"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dossiês por status</CardTitle>
            <CardDescription>Distribuição atual do funil de conformidade</CardDescription>
          </CardHeader>
          <CardContent>
            <DossiersByStatusChart data={dossiersByStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alertas em aberto por severidade</CardTitle>
            <CardDescription>Riscos regulatórios ainda não resolvidos</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertsBySeverityChart data={alertsBySeverity} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">Últimos dossiês</CardTitle>
              <CardDescription>Atualizados mais recentemente</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app/dossiers">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentDossiers.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum dossiê ainda.</p>}
            {recentDossiers.map((d) => (
              <Link
                key={d.id}
                href={`/app/dossiers/${d.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="font-medium">{d.internalNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.brand} · {d.productName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {d.complianceScore != null && <span className="text-xs text-muted-foreground">{d.complianceScore}/100</span>}
                  <DossierStatusBadge status={d.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {criticalDossiers.length > 0 && (
            <Card className="border-severity-critical/30 bg-severity-critical/5">
              <CardHeader>
                <CardTitle className="text-sm text-severity-critical">Risco regulatório — ação necessária</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {criticalDossiers.map((d) => (
                  <Link
                    key={d.id}
                    href={`/app/dossiers/${d.id}/review`}
                    className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm hover:bg-muted/60"
                  >
                    <span className="font-medium">{d.internalNumber}</span>
                    <Badge variant="critical">{d._count.alerts} crítico(s)</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListTodo className="h-4 w-4" /> Tarefas pendentes
              </CardTitle>
              <CardDescription>Dossiês parados há mais tempo aguardando ação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {pendingTaskDossiers.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente — tudo em dia.</p>
              )}
              {pendingTaskDossiers.map((d) => {
                const daysIdle = Math.floor((Date.now() - d.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
                const label = d.status === "documentos_pendentes" ? "aguardando documento" : "aguardando revisão";
                return (
                  <Link
                    key={d.id}
                    href={d.status === "em_revisao" ? `/app/dossiers/${d.id}/review` : `/app/dossiers/${d.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{d.internalNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.brand} · {label}
                      </p>
                    </div>
                    <Badge variant={daysIdle >= 3 ? "warning" : "neutral"} className="shrink-0">
                      {daysIdle === 0 ? "hoje" : `há ${daysIdle}d`}
                    </Badge>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Newspaper className="h-4 w-4" /> Publicações regulatórias novas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {newRegulatoryItems.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma publicação nova detectada.</p>
              )}
              {newRegulatoryItems.map((item) => (
                <div key={item.id} className="text-sm">
                  <p className="font-medium leading-snug">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.source.name} · {formatDistanceToNow(item.capturedAt, { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/app/regulatory-monitor">Ver monitor regulatório</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Lembrete de governança</AlertTitle>
        <AlertDescription>
          Nenhum dossiê pode ser aprovado apenas pela IA — toda aprovação final exige revisão humana registrada (RULE-014).
        </AlertDescription>
      </Alert>
    </div>
  );
}
