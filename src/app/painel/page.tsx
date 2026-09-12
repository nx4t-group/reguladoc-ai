import Link from "next/link";
import {
  ShieldAlert,
  ArrowRight,
  FileCheck,
  FileSearch,
  Hourglass,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { DossierStatusBadge } from "@/components/domain/status-badge";
import { AlertsBySeverityChart, DossiersByStatusChart } from "@/components/dashboard/charts";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ALERT_SEVERITIES, DOSSIER_STATUSES, type AlertSeverity, type DossierStatus } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { isDemo } from "@/lib/environment";

export default async function DashboardPage() {
  const tenant = await requireTenant();
  const organizationId = tenant.organizationId;
  const showDemoBadge = isDemo();

  const [
    totalDossiers,
    awaitingDocsCount,
    readyForReviewCount,
    blockedDossiersCount,
    awaitingDecisionCount,
    processedDocumentsCount,
    pendingFindingsCount,
    finishedRecentlyCount,
    recentDossiers,
    finishedDossiers,
    dossiersByStatusRaw,
    openAlertsBySeverityRaw,
  ] = await Promise.all([
    prisma.dossier.count({ where: { organizationId, deletedAt: null } }),
    // Aguardando Documentos
    prisma.dossier.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["AWAITING_DOCUMENTS", "documentos_pendentes", "DRAFT", "rascunho"] },
      },
    }),
    // Prontos para Revisão
    prisma.dossier.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["READY_FOR_REVIEW", "em_revisao", "PROCESSING", "processando"] },
      },
    }),
    // Bloqueados (status BLOCKED ou com findings críticos abertos)
    prisma.dossier.count({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { status: "BLOCKED" },
          { alerts: { some: { severity: "critica", status: { in: ["aberto", "confirmado"] } } } },
        ],
      },
    }),
    // Aguardando Decisão
    prisma.dossier.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["READY_FOR_APPROVAL", "aprovado_com_ressalvas"] },
      },
    }),
    // Documentos processados
    prisma.document.count({
      where: { organizationId, extractionStatus: "concluida" },
    }),
    // Findings pendentes
    prisma.validationAlert.count({
      where: { organizationId, status: { in: ["aberto", "confirmado"] } },
    }),
    // Concluídos recentemente
    prisma.dossier.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["APPROVED", "aprovado", "REJECTED", "reprovado"] },
      },
    }),
    // Fila Operacional (prioridade: atualizados recentemente)
    prisma.dossier.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        assignedTo: { select: { name: true } },
        _count: {
          select: {
            alerts: { where: { severity: "critica", status: { in: ["aberto", "confirmado"] } } },
          },
        },
      },
    }),
    // Para cálculo de tempo médio
    prisma.dossier.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ["APPROVED", "aprovado", "aprovado_com_ressalvas", "REJECTED", "reprovado"] },
      },
      select: { createdAt: true, updatedAt: true },
    }),
    prisma.dossier.groupBy({ by: ["status"], where: { organizationId, deletedAt: null }, _count: { _all: true } }),
    prisma.validationAlert.groupBy({
      by: ["severity"],
      where: { organizationId, status: { in: ["aberto", "confirmado"] } },
      _count: { _all: true },
    }),
  ]);

  const avgAnalysisDays =
    finishedDossiers.length > 0
      ? finishedDossiers.reduce((sum, d) => sum + (d.updatedAt.getTime() - d.createdAt.getTime()), 0) /
        finishedDossiers.length /
        (1000 * 60 * 60 * 24)
      : null;

  const dossiersByStatus: { status: DossierStatus; count: number }[] = DOSSIER_STATUSES.slice(0, 10).map((status) => ({
    status,
    count: dossiersByStatusRaw.find((d) => d.status === status)?._count._all ?? 0,
  }));

  const alertsBySeverity: { severity: AlertSeverity; count: number }[] = ALERT_SEVERITIES.map((severity) => ({
    severity,
    count: openAlertsBySeverityRaw.find((a) => a.severity === severity)?._count._all ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Painel Operacional · ${tenant.name.split(" ")[0]}`}
        description="O que requer sua atenção agora na conferência regulatória pré-embarque."
        actions={
          <div className="flex items-center gap-2">
            {showDemoBadge && (
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-2.5 py-1 text-xs">
                Ambiente demonstrativo
              </Badge>
            )}
            <Button asChild>
              <Link href="/painel/dossiers/new">Novo dossiê</Link>
            </Button>
          </div>
        }
      />

      {/* 4 KPIs PRINCIPAIS DE FOCO OPERACIONAL */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Aguardando documentos"
          value={awaitingDocsCount}
          icon={Hourglass}
          tone={awaitingDocsCount > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Prontos para revisão"
          value={readyForReviewCount}
          icon={FileSearch}
          tone={readyForReviewCount > 0 ? "default" : "default"}
        />
        <KpiCard
          label="Bloqueados"
          value={blockedDossiersCount}
          icon={ShieldAlert}
          tone={blockedDossiersCount > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Aguardando decisão"
          value={awaitingDecisionCount}
          icon={FileCheck}
          tone={awaitingDecisionCount > 0 ? "success" : "default"}
        />
      </div>

      {/* SEGUNDO PLANO: MÉTRICAS COMPLEMENTARES */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Tempo médio de análise</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {avgAnalysisDays == null ? "—" : avgAnalysisDays < 1 ? "< 1 dia" : `${avgAnalysisDays.toFixed(1)} dias`}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Documentos processados</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{processedDocumentsCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Findings pendentes</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{pendingFindingsCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Processos concluídos</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{finishedRecentlyCount}</p>
        </div>
      </div>

      {/* FILA OPERACIONAL (SUBSTITUIÇÃO DE RECENTES SIMPLES) */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Fila Operacional de Processos</CardTitle>
            <CardDescription className="text-xs">
              Processos ordenados por necessidade de conferência e atualização recente.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/painel/dossiers" className="gap-1 text-xs">
              Ver todos ({totalDossiers}) <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead>Dossiê</TableHead>
                  <TableHead>Cliente / Importador</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Blockers</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Última atualização</TableHead>
                  <TableHead className="text-right">Próxima ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDossiers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum processo cadastrado. Clique em &quot;Novo dossiê&quot; para iniciar.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentDossiers.map((d) => {
                    const blockers = d._count.alerts;
                    const isAwaitingDocs =
                      d.status === "AWAITING_DOCUMENTS" || d.status === "documentos_pendentes" || d.status === "DRAFT";
                    const isReadyForApproval = d.status === "READY_FOR_APPROVAL";
                    const isApproved = d.status === "APPROVED" || d.status === "aprovado";

                    let actionText = "Revisar findings";
                    let actionVariant: "default" | "outline" | "secondary" | "ghost" = "default";
                    const actionHref = `/painel/dossiers/${d.id}`;

                    if (isAwaitingDocs) {
                      actionText = "Anexar documentos";
                      actionVariant = "outline";
                    } else if (blockers > 0) {
                      actionText = "Tratar blockers";
                      actionVariant = "default";
                    } else if (isReadyForApproval) {
                      actionText = "Emitir decisão";
                      actionVariant = "default";
                    } else if (isApproved) {
                      actionText = "Ver parecer";
                      actionVariant = "ghost";
                    }

                    return (
                      <TableRow key={d.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold">
                          <Link href={`/painel/dossiers/${d.id}`} className="text-foreground hover:text-primary hover:underline">
                            {d.internalNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">{d.importerName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground">{d.brand}</span>
                            <span className="block text-xs">{d.productName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DossierStatusBadge status={d.status} />
                        </TableCell>
                        <TableCell>
                          {blockers > 0 ? (
                            <Badge variant="critical" className="gap-1 text-xs">
                              <ShieldAlert className="h-3 w-3" />
                              {blockers} {blockers === 1 ? "crítico" : "críticos"}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">0 blockers</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {d.assignedTo?.name ?? "Não atribuído"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant={actionVariant} className="h-8 text-xs font-medium" asChild>
                            <Link href={actionHref}>{actionText}</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* GRÁFICOS DE DISTRIBUIÇÃO */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribuição por status</CardTitle>
            <CardDescription>Visualização analítica do pipeline documental</CardDescription>
          </CardHeader>
          <CardContent>
            <DossiersByStatusChart data={dossiersByStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Findings abertos por severidade</CardTitle>
            <CardDescription>Riscos documentais que demandam análise humana</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertsBySeverityChart data={alertsBySeverity} />
          </CardContent>
        </Card>
      </div>

      {/* DISCLAIMER DE APOIO À DECISÃO */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">Princípio do RegulaDoc AI</p>
        <p>
          O sistema atua como workspace inteligente de conferência regulatória documental pré-embarque. Toda
          recomendação de liberação constitui apoio à decisão do especialista e não substitui a atuação dos órgãos
          anuentes oficiais (MAPA, Receita Federal, ANVISA).
        </p>
      </div>
    </div>
  );
}
