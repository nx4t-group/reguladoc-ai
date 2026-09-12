import Link from "next/link";
import {
  ShieldAlert,
  ArrowRight,
  FileCheck,
  FileSearch,
  Hourglass,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DossierStatusBadge } from "@/components/domain/status-badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
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
    priorityDossiers,
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
    // Bloqueados
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
    // Fila Operacional completa
    prisma.dossier.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 10,
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
    // Prioridades: bloqueados críticos primeiro, depois revisão, depois mais antigos
    prisma.dossier.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: {
          notIn: ["APPROVED", "aprovado", "REJECTED", "reprovado", "ARCHIVED", "arquivado"],
        },
      },
      orderBy: [{ updatedAt: "asc" }],
      take: 5,
      include: {
        assignedTo: { select: { name: true } },
        _count: {
          select: {
            alerts: { where: { severity: "critica", status: { in: ["aberto", "confirmado"] } } },
          },
        },
      },
    }),
  ]);

  const avgAnalysisDays =
    finishedDossiers.length > 0
      ? finishedDossiers.reduce((sum, d) => sum + (d.updatedAt.getTime() - d.createdAt.getTime()), 0) /
        finishedDossiers.length /
        (1000 * 60 * 60 * 24)
      : null;

  const attentionCount = awaitingDocsCount + readyForReviewCount + blockedDossiersCount + awaitingDecisionCount;

  // Ordenar prioridades: bloqueados críticos primeiro
  const sortedPriorities = [...priorityDossiers].sort((a, b) => {
    const aBlocked = a.status === "BLOCKED" || a._count.alerts > 0;
    const bBlocked = b.status === "BLOCKED" || b._count.alerts > 0;
    if (aBlocked && !bBlocked) return -1;
    if (!aBlocked && bBlocked) return 1;
    return 0;
  });

  return (
    <div className="space-y-8">
      {/* CABEÇALHO */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Painel Operacional
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            {attentionCount > 0 ? (
              <><span className="font-semibold text-foreground">{attentionCount}</span> {attentionCount === 1 ? "processo precisa" : "processos precisam"} da sua atenção hoje.</>
            ) : (
              "Todos os processos estão em dia."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showDemoBadge && (
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-2.5 py-1 text-xs">
              Ambiente demonstrativo
            </Badge>
          )}
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/painel/dossiers/new">
              <Plus className="h-4 w-4" />
              Novo dossiê
            </Link>
          </Button>
        </div>
      </div>

      {/* 4 KPIs PRINCIPAIS — clicáveis, filtram a fila */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Aguardando documentos"
          value={awaitingDocsCount}
          icon={Hourglass}
          tone={awaitingDocsCount > 0 ? "warning" : "default"}
          href="/painel/dossiers?filter=awaiting_docs"
        />
        <KpiCard
          label="Prontos para revisão"
          value={readyForReviewCount}
          icon={FileSearch}
          tone={readyForReviewCount > 0 ? "default" : "default"}
          href="/painel/dossiers?filter=ready_review"
        />
        <KpiCard
          label="Bloqueados"
          value={blockedDossiersCount}
          icon={ShieldAlert}
          tone={blockedDossiersCount > 0 ? "danger" : "default"}
          href="/painel/dossiers?filter=blocked"
        />
        <KpiCard
          label="Aguardando decisão"
          value={awaitingDecisionCount}
          icon={FileCheck}
          tone={awaitingDecisionCount > 0 ? "success" : "default"}
          href="/painel/dossiers?filter=decision"
        />
      </div>

      {/* FAIXA DE MÉTRICAS SECUNDÁRIAS — compacta, não compete com a fila */}
      <div className="flex flex-wrap items-center gap-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {[
          {
            icon: Clock,
            label: "Tempo médio de análise",
            value: avgAnalysisDays == null ? "—" : avgAnalysisDays < 1 ? "< 1 dia" : `${avgAnalysisDays.toFixed(1)} dias`,
          },
          {
            icon: FileText,
            label: "Documentos processados",
            value: processedDocumentsCount.toString(),
          },
          {
            icon: AlertTriangle,
            label: "Findings pendentes",
            value: pendingFindingsCount.toString(),
          },
          {
            icon: CheckCircle2,
            label: "Processos concluídos",
            value: finishedRecentlyCount.toString(),
          },
        ].map((metric, idx, arr) => (
          <div
            key={metric.label}
            className={`flex flex-1 items-center gap-3 px-5 py-3.5 min-w-[160px] ${idx < arr.length - 1 ? "border-r border-border" : ""}`}
          >
            <metric.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">{metric.label}</p>
              <p className="text-[15px] font-semibold text-foreground">{metric.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* PRIORIDADES DE HOJE */}
      {sortedPriorities.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-foreground">Prioridades de hoje</h2>
            <span className="text-[13px] text-muted-foreground">{sortedPriorities.length} processos</span>
          </div>
          <div className="space-y-2">
            {sortedPriorities.map((d) => {
              const blockers = d._count.alerts;
              const isAwaitingDocs = d.status === "AWAITING_DOCUMENTS" || d.status === "documentos_pendentes" || d.status === "DRAFT";
              const isReadyForApproval = d.status === "READY_FOR_APPROVAL";
              const isApproved = d.status === "APPROVED" || d.status === "aprovado";
              const isBlocked = d.status === "BLOCKED" || blockers > 0;

              let actionText = "Revisar findings";
              if (isAwaitingDocs) actionText = "Anexar documentos";
              else if (isBlocked) actionText = "Tratar bloqueios";
              else if (isReadyForApproval) actionText = "Emitir decisão";
              else if (isApproved) actionText = "Ver parecer";

              let situacao = "Em conferência";
              if (isAwaitingDocs) situacao = "Aguardando documentação";
              else if (isBlocked) situacao = `${blockers} bloqueio(s) crítico(s)`;
              else if (d.status === "READY_FOR_REVIEW" || d.status === "em_revisao") situacao = "Pronto para revisão";
              else if (isReadyForApproval) situacao = "Aguardando decisão";

              return (
                <div
                  key={d.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm hover:shadow-md hover:border-border/80 transition-all duration-150"
                >
                  {/* Indicador de urgência */}
                  <div className={`h-2 w-2 rounded-full shrink-0 ${isBlocked ? "bg-severity-critical" : isReadyForApproval ? "bg-violet-500" : isAwaitingDocs ? "bg-status-warning" : "bg-severity-low"}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-bold text-foreground">{d.internalNumber}</span>
                      {isBlocked && (
                        <Badge variant="critical" className="gap-1 text-[11px]">
                          <ShieldAlert className="h-3 w-3" />
                          {blockers} bloqueio(s)
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground truncate">
                      <span className="font-medium text-foreground">{d.importerName}</span>
                      {d.brand && <> · {d.brand}</>}
                      {d.productName && <> · {d.productName}</>}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {situacao} · atualizado {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>

                  <Button size="sm" asChild className="shrink-0 gap-1 text-[13px] font-medium">
                    <Link href={`/painel/dossiers/${d.id}`}>
                      {actionText}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILA OPERACIONAL COMPLETA */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-foreground">Todos os processos</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/painel/dossiers" className="gap-1 text-[13px]">
              Ver lista completa ({totalDossiers}) <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <Card className="border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground py-3">Dossiê</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente / Importador</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Produto</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Blockers</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Responsável</TableHead>
                  <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Última atualização</TableHead>
                  <TableHead className="text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Próxima ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDossiers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[14px] text-muted-foreground">
                      Nenhum processo cadastrado. Clique em &quot;Novo dossiê&quot; para iniciar.
                    </td>
                  </tr>
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
                      actionText = "Tratar bloqueios";
                      actionVariant = "default";
                    } else if (isReadyForApproval) {
                      actionText = "Emitir decisão";
                      actionVariant = "default";
                    } else if (isApproved) {
                      actionText = "Ver parecer";
                      actionVariant = "ghost";
                    }

                    return (
                      <TableRow key={d.id} className="hover:bg-muted/25 transition-colors">
                        <TableCell className="py-4 font-bold text-[14px]">
                          <Link href={`/painel/dossiers/${d.id}`} className="text-foreground hover:text-primary hover:underline">
                            {d.internalNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="py-4 text-[14px] font-medium text-foreground">{d.importerName}</TableCell>
                        <TableCell className="py-4">
                          <div>
                            <span className="text-[14px] font-medium text-foreground">{d.brand}</span>
                            <span className="block text-[13px] text-muted-foreground">{d.productName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <DossierStatusBadge status={d.status} />
                        </TableCell>
                        <TableCell className="py-4">
                          {blockers > 0 ? (
                            <Badge variant="critical" className="gap-1 text-[12px]">
                              <ShieldAlert className="h-3 w-3" />
                              {blockers} {blockers === 1 ? "crítico" : "críticos"}
                            </Badge>
                          ) : (
                            <span className="text-[13px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 text-[13px] text-muted-foreground">
                          {d.assignedTo?.name ?? "Não atribuído"}
                        </TableCell>
                        <TableCell className="py-4 text-[13px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                        <TableCell className="py-4 text-right">
                          <Button size="sm" variant={actionVariant} className="h-8 text-[13px] font-medium" asChild>
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
        </Card>
      </div>
    </div>
  );
}
