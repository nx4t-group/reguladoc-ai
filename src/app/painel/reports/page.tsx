import Link from "next/link";
import { FileBarChart, TrendingUp, Clock, FileText, CheckCircle2, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { AlertsBySeverityChart, DossiersByStatusChart } from "@/components/dashboard/charts";
import { scoreClassification, DOSSIER_STATUSES, ALERT_SEVERITIES, type DossierStatus, type AlertSeverity } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export default async function ReportsPage() {
  const tenant = await requireTenant();

  const [
    reports,
    dossiersByStatusRaw,
    openAlertsBySeverityRaw,
    totalDossiers,
    processedDocumentsCount,
    finishedDossiers,
  ] = await Promise.all([
    prisma.report.findMany({
      where: { organizationId: tenant.organizationId },
      include: {
        dossier: { select: { id: true, internalNumber: true, complianceScore: true } },
        generatedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.dossier.groupBy({
      by: ["status"],
      where: { organizationId: tenant.organizationId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.validationAlert.groupBy({
      by: ["severity"],
      where: { organizationId: tenant.organizationId, status: { in: ["aberto", "confirmado"] } },
      _count: { _all: true },
    }),
    prisma.dossier.count({ where: { organizationId: tenant.organizationId, deletedAt: null } }),
    prisma.document.count({ where: { organizationId: tenant.organizationId, extractionStatus: "concluida" } }),
    prisma.dossier.findMany({
      where: {
        organizationId: tenant.organizationId,
        deletedAt: null,
        status: { in: ["APPROVED", "aprovado", "REJECTED", "reprovado"] },
      },
      select: { createdAt: true, updatedAt: true },
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

  const conclusionRate = totalDossiers > 0 ? Math.round((finishedDossiers.length / totalDossiers) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Relatórios & Análises"
        description="Visão analítica da operação de conferência regulatória e pareceres emitidos."
      />

      {/* MÉTRICAS ANALÍTICAS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            icon: Clock,
            label: "Tempo médio de análise",
            value: avgAnalysisDays == null ? "—" : avgAnalysisDays < 1 ? "< 1 dia" : `${avgAnalysisDays.toFixed(1)}d`,
          },
          {
            icon: FileText,
            label: "Documentos processados",
            value: processedDocumentsCount.toLocaleString("pt-BR"),
          },
          {
            icon: CheckCircle2,
            label: "Processos concluídos",
            value: finishedDossiers.length.toLocaleString("pt-BR"),
          },
          {
            icon: TrendingUp,
            label: "Taxa de conclusão",
            value: `${conclusionRate}%`,
          },
        ].map((m) => (
          <Card key={m.label} className="border-border/80 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <m.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold text-foreground">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GRÁFICOS ANALÍTICOS */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold">Distribuição por status</CardTitle>
            <CardDescription className="text-[13px]">Pipeline documental — todos os processos ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <DossiersByStatusChart data={dossiersByStatus} />
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-semibold">Findings abertos por severidade</CardTitle>
            <CardDescription className="text-[13px]">Riscos documentais que demandam análise humana</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertsBySeverityChart data={alertsBySeverity} />
          </CardContent>
        </Card>
      </div>

      {/* PARECERES EMITIDOS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-foreground">Pareceres emitidos</h2>
          <Button variant="outline" size="sm" className="gap-1.5 text-[13px]">
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>

        {reports.length === 0 ? (
          <Card className="border-border shadow-sm">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <FileBarChart className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-[15px] font-medium">Nenhum parecer gerado ainda.</p>
              <p className="text-[13px] text-muted-foreground/70">Os pareceres aparecerão aqui após emissão nos dossiês.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground py-3">Título</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Score</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Resultado</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Emitido por</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Aprovado por</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const classification =
                    report.dossier.complianceScore != null
                      ? scoreClassification(report.dossier.complianceScore)
                      : null;
                  return (
                    <TableRow key={report.id} className="hover:bg-muted/25 transition-colors">
                      <TableCell className="py-4">
                        <Link href={`/painel/dossiers/${report.dossier.id}`} className="text-[14px] font-semibold text-foreground hover:text-primary hover:underline">
                          {report.title}
                        </Link>
                        <p className="text-[12px] text-muted-foreground mt-0.5">{report.dossier.internalNumber}</p>
                      </TableCell>
                      <TableCell className="py-4 text-[14px] font-semibold text-foreground">
                        {report.dossier.complianceScore ?? "—"}/100
                      </TableCell>
                      <TableCell className="py-4">
                        {classification && (
                          <Badge
                            variant={
                              classification.tone === "destructive"
                                ? "destructive"
                                : classification.tone === "success"
                                ? "success"
                                : "warning"
                            }
                          >
                            {classification.label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-[13px] text-muted-foreground">{report.generatedBy.name}</TableCell>
                      <TableCell className="py-4 text-[13px] text-muted-foreground">{report.approvedBy?.name ?? "—"}</TableCell>
                      <TableCell className="py-4 text-[13px] text-muted-foreground whitespace-nowrap">
                        {format(report.generatedAt, "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
