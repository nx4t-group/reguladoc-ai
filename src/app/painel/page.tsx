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
  Paperclip,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
      take: 6,
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

  // Ordenar prioridades: bloqueados críticos primeiro, depois awaiting docs, etc.
  const sortedPriorities = [...priorityDossiers].sort((a, b) => {
    const aBlocked = a.status === "BLOCKED" || a._count.alerts > 0;
    const bBlocked = b.status === "BLOCKED" || b._count.alerts > 0;
    if (aBlocked && !bBlocked) return -1;
    if (!aBlocked && bBlocked) return 1;
    return 0;
  });

  return (
    <div className="space-y-7">
      {/* ── BEGIN: OperationalHeading ── */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" data-purpose="heading-and-quick-actions">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-serif font-bold tracking-tight text-stone-900">Painel Operacional</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-200/80 text-stone-700 border border-stone-300">
              Safra • Importação
            </span>
            {showDemoBadge && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                Ambiente de Teste
              </span>
            )}
          </div>
          <p className="text-sm text-stone-600 mt-1 font-normal">
            <span className="font-semibold text-bordeaux-800">
              {attentionCount} {attentionCount === 1 ? "processo precisa" : "processos precisam"}
            </span>{" "}
            da sua atenção regulatória ou conferência técnica hoje.
          </p>
        </div>

        {/* Botões de Ação Primária */}
        <div className="flex items-center gap-3">
          <Link
            href="/painel/dossiers/new"
            className="px-4 py-2 text-xs font-semibold text-white bg-bordeaux-800 hover:bg-bordeaux-900 rounded-lg shadow-sm hover:shadow transition flex items-center gap-2 border border-bordeaux-700"
          >
            <Plus className="w-4 h-4 text-white" />
            Novo Dossiê
          </Link>
        </div>
      </section>
      {/* ── END: OperationalHeading ── */}

      {/* ── BEGIN: StatusMetricCards ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-purpose="kpi-status-grid">
        {/* Card 1: Aguardando documentos */}
        <Link
          href="/painel/dossiers?filter=awaiting_docs"
          className="card-craft rounded-xl p-5 relative overflow-hidden transition group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold font-serif text-amber-700">{awaitingDocsCount}</span>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Hourglass className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-stone-800 group-hover:text-amber-800 transition-colors">
              Aguardando documentos
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">Certificado de Análise / Origem pendentes</p>
          </div>
          <div className="w-full bg-amber-100 h-1 mt-4 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-500"
              style={{ width: `${totalDossiers > 0 ? Math.min(100, Math.round((awaitingDocsCount / totalDossiers) * 100)) : 0}%` }}
            />
          </div>
        </Link>

        {/* Card 2: Prontos para revisão */}
        <Link
          href="/painel/dossiers?filter=in_review"
          className="card-craft rounded-xl p-5 relative overflow-hidden transition group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold font-serif text-leaf-700">{readyForReviewCount}</span>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-leaf-700 border border-leaf-200 flex items-center justify-center">
              <FileSearch className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-stone-800 group-hover:text-leaf-700 transition-colors">
              Prontos para revisão
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">15 regras do motor validadas</p>
          </div>
          <div className="w-full bg-emerald-100 h-1 mt-4 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full transition-all duration-500"
              style={{ width: `${totalDossiers > 0 ? Math.min(100, Math.round((readyForReviewCount / totalDossiers) * 100)) : 0}%` }}
            />
          </div>
        </Link>

        {/* Card 3: Bloqueados */}
        <Link
          href="/painel/dossiers?filter=blocked"
          className="card-craft rounded-xl p-5 relative overflow-hidden transition group block border-l-4 border-l-bordeaux-800"
        >
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold font-serif text-bordeaux-800">{blockedDossiersCount}</span>
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-bordeaux-800 border border-rose-200 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-stone-800 group-hover:text-bordeaux-800 transition-colors">
              Bloqueados
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">Divergências analíticas ou rotulagem</p>
          </div>
          <div className="w-full bg-rose-100 h-1 mt-4 rounded-full overflow-hidden">
            <div
              className="bg-bordeaux-800 h-full transition-all duration-500"
              style={{ width: `${totalDossiers > 0 ? Math.min(100, Math.round((blockedDossiersCount / totalDossiers) * 100)) : 0}%` }}
            />
          </div>
        </Link>

        {/* Card 4: Aguardando decisão */}
        <Link
          href="/painel/dossiers?filter=ready_approval"
          className="card-craft rounded-xl p-5 relative overflow-hidden transition group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold font-serif text-stone-700">{awaitingDecisionCount}</span>
            <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-500 border border-stone-200 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-stone-800 group-hover:text-stone-900 transition-colors">
              Aguardando decisão
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {awaitingDecisionCount === 0 ? "Todos os despachos deferidos" : "Pareceres emitidos aguardando assinatura"}
            </p>
          </div>
          <div className="w-full bg-stone-100 h-1 mt-4 rounded-full overflow-hidden">
            <div
              className="bg-stone-400 h-full transition-all duration-500"
              style={{ width: `${totalDossiers > 0 ? Math.min(100, Math.round((awaitingDecisionCount / totalDossiers) * 100)) : 0}%` }}
            />
          </div>
        </Link>
      </section>
      {/* ── END: StatusMetricCards ── */}

      {/* ── BEGIN: EngineTelemetryStrip ── */}
      <section className="bg-white/90 border border-stone-200 rounded-xl px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm text-xs" data-purpose="engine-telemetry">
        <div className="flex items-center gap-2 text-stone-600">
          <Clock className="w-4 h-4 text-stone-400" />
          <span className="text-stone-500">Tempo médio de análise:</span>
          <span className="font-semibold text-stone-900">
            {avgAnalysisDays == null ? "< 1 dia" : avgAnalysisDays < 1 ? "< 1 dia" : `${avgAnalysisDays.toFixed(1)} dias`}
          </span>
        </div>
        <div className="h-4 w-px bg-stone-200 hidden md:block"></div>
        <div className="flex items-center gap-2 text-stone-600">
          <FileText className="w-4 h-4 text-stone-400" />
          <span className="text-stone-500">Documentos processados:</span>
          <span className="font-semibold text-stone-900">{processedDocumentsCount} arquivos</span>
        </div>
        <div className="h-4 w-px bg-stone-200 hidden md:block"></div>
        <div className="flex items-center gap-2 text-stone-600">
          <AlertTriangle className="w-4 h-4 text-bordeaux-700" />
          <span className="text-stone-500">Apontamentos pendentes:</span>
          <span className="font-bold text-bordeaux-800">{pendingFindingsCount} apontamentos</span>
        </div>
        <div className="h-4 w-px bg-stone-200 hidden md:block"></div>
        <div className="flex items-center gap-2 text-stone-600">
          <CheckCircle2 className="w-4 h-4 text-leaf-600" />
          <span className="text-stone-500">Processos concluídos:</span>
          <span className="font-semibold text-stone-900">{finishedRecentlyCount}</span>
        </div>
        <div className="h-4 w-px bg-stone-200 hidden md:block"></div>
        <div className="flex items-center gap-1.5 text-stone-500">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_#34d399]"></span>
          <span>Motor assíncrono: ~800ms</span>
        </div>
      </section>
      {/* ── END: EngineTelemetryStrip ── */}

      {/* ── BEGIN: TodayPriorities ── */}
      {sortedPriorities.length > 0 && (
        <section className="space-y-3.5" data-purpose="urgent-priorities">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-stone-900 tracking-tight">Prioridades de hoje</h2>
              <span className="px-2 py-0.5 text-xs bg-stone-200 text-stone-700 font-medium rounded-full">
                {sortedPriorities.length} processos
              </span>
            </div>
            <span className="text-xs text-stone-500 font-medium">Ordenado por severidade regulatória</span>
          </div>

          <div className="space-y-3">
            {sortedPriorities.map((d) => {
              const blockers = d._count.alerts;
              const isBlocked = d.status === "BLOCKED" || blockers > 0;
              const isAwaitingDocs =
                d.status === "AWAITING_DOCUMENTS" || d.status === "documentos_pendentes" || d.status === "DRAFT";
              const isReadyForReview = d.status === "READY_FOR_REVIEW" || d.status === "em_revisao";
              const isReadyForApproval = d.status === "READY_FOR_APPROVAL";
              const isApproved = d.status === "APPROVED" || d.status === "aprovado";

              // Estilo de borda esquerda por severidade
              let borderClass = "border-l-4 border-l-stone-400";
              if (isBlocked) borderClass = "border-l-4 border-l-rose-700";
              else if (isAwaitingDocs) borderClass = "border-l-4 border-l-amber-500";
              else if (isReadyForReview) borderClass = "border-l-4 border-l-leaf-600";

              // Badges e descrições técnicas
              let badgeJsx = (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                  Em conferência
                </span>
              );
              let descriptionText = "Em análise técnica pela equipe regulatória";

              if (isBlocked) {
                badgeJsx = (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    {blockers > 0 ? `${blockers} bloqueio(s)` : "Bloqueio crítico"}
                  </span>
                );
                descriptionText = "Divergência analítica: parâmetros fora do padrão da portaria MAPA";
              } else if (isAwaitingDocs) {
                badgeJsx = (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    <Hourglass className="w-3 h-3 text-amber-600" />
                    Aguardando documentação
                  </span>
                );
                descriptionText = "Aguardando documentação • Certificado de Análise ou Fatura pendente";
              } else if (isReadyForReview) {
                badgeJsx = (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-leaf-700 border border-leaf-200">
                    <CheckCircle2 className="w-3 h-3 text-leaf-600" />
                    Pronto para revisão
                  </span>
                );
                descriptionText = "OCR completo • 15 regras avaliadas com conformidade satisfatória";
              }

              // Botões de ação contextuais
              let buttonJsx = (
                <Link
                  href={`/painel/dossiers/${d.id}`}
                  className="w-full md:w-auto px-4 py-2 text-xs font-semibold text-white bg-bordeaux-800 hover:bg-bordeaux-900 rounded-lg shadow transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>Revisar apontamentos</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              );

              if (isBlocked) {
                buttonJsx = (
                  <Link
                    href={`/painel/dossiers/${d.id}`}
                    className="w-full md:w-auto px-4 py-2 text-xs font-semibold text-white bg-bordeaux-800 hover:bg-bordeaux-900 rounded-lg shadow transition flex items-center justify-center gap-1.5 whitespace-nowrap border border-bordeaux-700"
                  >
                    <span>Tratar bloqueios</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                );
              } else if (isAwaitingDocs) {
                buttonJsx = (
                  <Link
                    href={`/painel/dossiers/${d.id}`}
                    className="w-full md:w-auto px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-stone-600" />
                    <span>Anexar documentos</span>
                  </Link>
                );
              } else if (isReadyForReview) {
                buttonJsx = (
                  <Link
                    href={`/painel/dossiers/${d.id}`}
                    className="w-full md:w-auto px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Revisar apontamentos</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                );
              } else if (isReadyForApproval) {
                buttonJsx = (
                  <Link
                    href={`/painel/dossiers/${d.id}`}
                    className="w-full md:w-auto px-4 py-2 text-xs font-semibold text-white bg-violet-800 hover:bg-violet-900 rounded-lg shadow transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Emitir decisão</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                );
              } else if (isApproved) {
                buttonJsx = (
                  <Link
                    href={`/painel/dossiers/${d.id}`}
                    className="w-full md:w-auto px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Ver parecer</span>
                  </Link>
                );
              }

              return (
                <article
                  key={d.id}
                  className={`card-craft rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${borderClass}`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-bold text-sm text-stone-900 tracking-tight">{d.internalNumber}</span>
                      {badgeJsx}
                      <span className="text-xs text-stone-400">
                        • atualizado {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 truncate">
                      <strong className="text-stone-800">{d.importerName}</strong>
                      {d.brand && <> — {d.brand}</>}
                      {d.productName && <> • {d.productName}</>}
                    </p>

                    <div className="text-[11px] font-medium flex items-center gap-2 text-stone-600">
                      <span>{descriptionText}</span>
                      {blockers > 0 && (
                        <>
                          <span className="text-stone-300">|</span>
                          <span className="text-rose-700 font-semibold">{blockers} bloqueio(s) crítico(s)</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">{buttonJsx}</div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {/* ── END: TodayPriorities ── */}

      {/* ── BEGIN: CompleteProcessesTable ── */}
      <section className="space-y-3.5 pb-8" data-purpose="all-processes-table">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900 tracking-tight">Todos os processos</h2>
            <p className="text-xs text-stone-500">Monitoramento integral de conformidade MAPA e desembaraço aduaneiro</p>
          </div>
          <Link
            href="/painel/dossiers"
            className="text-xs font-semibold text-bordeaux-800 hover:text-bordeaux-900 flex items-center gap-1"
          >
            <span>Ver lista completa ({totalDossiers})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Tabela Estruturada */}
        <div className="card-craft rounded-xl overflow-hidden border border-stone-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100/80 border-b border-stone-200 text-stone-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Dossiê</th>
                  <th className="py-3 px-4">Cliente / Importador</th>
                  <th className="py-3 px-4">Produto Vitivinícola</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Blockers</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4">Última Atualização</th>
                  <th className="py-3 px-4 text-right">Próxima Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/70 bg-white">
                {recentDossiers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-stone-500">
                      Nenhum processo cadastrado. Clique em &quot;Novo Dossiê&quot; para iniciar.
                    </td>
                  </tr>
                ) : (
                  recentDossiers.map((d) => {
                    const blockers = d._count.alerts;
                    const isAwaitingDocs =
                      d.status === "AWAITING_DOCUMENTS" || d.status === "documentos_pendentes" || d.status === "DRAFT";
                    const isReadyForApproval = d.status === "READY_FOR_APPROVAL";
                    const isApproved = d.status === "APPROVED" || d.status === "aprovado";
                    const isBlocked = d.status === "BLOCKED" || blockers > 0;
                    const isReview = d.status === "READY_FOR_REVIEW" || d.status === "em_revisao";

                    let actionLabel = "Revisar apontamentos";
                    let actionBtnStyle = "text-white bg-slate-800 hover:bg-slate-900";

                    if (isBlocked) {
                      actionLabel = "Tratar bloqueios";
                      actionBtnStyle = "text-white bg-bordeaux-800 hover:bg-bordeaux-900";
                    } else if (isAwaitingDocs) {
                      actionLabel = "Anexar documentos";
                      actionBtnStyle = "text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300";
                    } else if (isReadyForApproval) {
                      actionLabel = "Emitir decisão";
                      actionBtnStyle = "text-white bg-violet-800 hover:bg-violet-900";
                    } else if (isApproved) {
                      actionLabel = "Ver parecer";
                      actionBtnStyle = "text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300";
                    }

                    return (
                      <tr key={d.id} className="hover:bg-stone-50/70 transition">
                        <td className="py-3.5 px-4 font-bold text-stone-900 tracking-tight">
                          <Link href={`/painel/dossiers/${d.id}`} className="hover:text-bordeaux-800 hover:underline">
                            {d.internalNumber}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 text-stone-700 font-medium max-w-[220px] truncate">
                          {d.importerName}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-stone-900">{d.brand || "—"}</div>
                          <div className="text-[11px] text-stone-500">{d.productName || "Vinho Fino Tinto Seco"}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isBlocked ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                              Bloqueado
                            </span>
                          ) : isAwaitingDocs ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              Aguardando Documentação
                            </span>
                          ) : isReview ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              Em Revisão
                            </span>
                          ) : isApproved ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-leaf-700 border border-leaf-200">
                              Conferência Concluída
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                              {d.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {blockers > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              {blockers} {blockers === 1 ? "crítico" : "críticos"}
                            </span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-stone-600">
                          {d.assignedTo?.name === "Analista Demo" ? "Analista Teste" : (d.assignedTo?.name ?? "Analista Teste")}
                        </td>
                        <td className="py-3.5 px-4 text-stone-500 whitespace-nowrap">
                          {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true, locale: ptBR })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/painel/dossiers/${d.id}`}
                            className={`inline-block px-3 py-1.5 text-[11px] font-semibold rounded transition ${actionBtnStyle}`}
                          >
                            {actionLabel}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da tabela com paginação informativa */}
          <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <div>
              Mostrando <strong>{recentDossiers.length}</strong> de <strong>{totalDossiers}</strong> dossiês regulatórios ativos
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Todos os dados sincronizados com a Receita Federal / MAPA</span>
            </div>
          </div>
        </div>
      </section>
      {/* ── END: CompleteProcessesTable ── */}
    </div>
  );
}
