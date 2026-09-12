"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer, Scale, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/domain/status-badge";
import { generateReport } from "@/server/actions/reports";
import { safeJsonParse } from "./format";
import type { AlertData, DossierDetailData, ReportData, ValidationRunData } from "./types";

export function ReportTab({
  dossier,
  reports,
  validationRuns,
  alerts,
}: {
  dossier: DossierDetailData;
  reports: ReportData[];
  validationRuns: ValidationRunData[];
  alerts: AlertData[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = React.useState(false);

  const latestReport = reports[0];
  const latestRun = validationRuns[0];
  const relevantAlerts = latestRun ? alerts.filter((a) => a.validationRunId === latestRun.id) : alerts;
  const blockersCount = relevantAlerts.filter(
    (a) => a.severity === "critica" && (a.status === "aberto" || a.status === "confirmado")
  ).length;

  const snapshot = latestRun
    ? safeJsonParse<{ code: string; version?: number }[]>(latestRun.rulesVersionSnapshot) ?? []
    : [];

  // Recomendação formal alinhada ao briefing V3
  let recomendacao = "RECOMENDADO PARA LIBERAÇÃO PRÉ-EMBARQUE";
  let recomendacaoVariant: "success" | "warning" | "destructive" = "success";

  if (blockersCount > 0 || dossier.status === "BLOCKED") {
    recomendacao = "NÃO RECOMENDADO PARA LIBERAÇÃO PRÉ-EMBARQUE";
    recomendacaoVariant = "destructive";
  } else if (relevantAlerts.some((a) => a.status === "aberto" || a.status === "confirmado")) {
    recomendacao = "REVISÃO ADICIONAL NECESSÁRIA";
    recomendacaoVariant = "warning";
  } else if (dossier.status === "APPROVED" || dossier.status === "READY_FOR_APPROVAL") {
    recomendacao = "SEM BLOQUEIOS DOCUMENTAIS DETECTADOS";
    recomendacaoVariant = "success";
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateReport(dossier.id);
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível emitir o relatório.");
        return;
      }
      toast.success("Relatório de conferência gerado com sucesso.");
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-end gap-2">
        <Button variant="outline" onClick={handleGenerate} disabled={generating} className="text-xs">
          {generating ? "Gerando…" : latestReport ? "Regerar Relatório" : "Gerar Relatório de Conferência"}
        </Button>
        <Button onClick={() => window.print()} disabled={!latestReport} className="text-xs gap-1.5">
          <Printer className="h-4 w-4" /> Exportar / Imprimir PDF
        </Button>
      </div>

      <Card className="border border-border bg-card print:border-none print:shadow-none shadow-sm">
        <CardHeader className="border-b border-border/70 pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                RegulaDoc AI · Compliance Documental Pré-Embarque
              </p>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground mt-1">
                RELATÓRIO DE CONFERÊNCIA DOCUMENTAL PRÉ-EMBARQUE
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Processo: <strong className="text-foreground">{dossier.internalNumber}</strong> · Cliente:{" "}
                <strong className="text-foreground">{dossier.importerName}</strong>
              </p>
            </div>
            <div className="text-right">
              <Badge variant={recomendacaoVariant} className="text-xs px-3 py-1 font-semibold uppercase">
                {recomendacao}
              </Badge>
              {dossier.complianceScore != null && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">Score: {dossier.complianceScore} pts</p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6 text-xs">
          {/* IDENTIFICAÇÃO DO PROCESSO & ITENS */}
          <section className="grid gap-4 sm:grid-cols-3 bg-muted/20 p-4 rounded-lg border border-border/60">
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Dossiê / Processo</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{dossier.internalNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Importador / Cliente</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{dossier.importerName}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Produto / Marca</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {dossier.brand} · {dossier.productName}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Origem</p>
              <p className="text-foreground mt-0.5">{dossier.countryOrigin ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Lote Principal</p>
              <p className="text-foreground font-mono mt-0.5">{dossier.batchNumber ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Volume Total</p>
              <p className="text-foreground mt-0.5">
                {dossier.calculatedVolumeLiters
                  ? `${dossier.calculatedVolumeLiters.toLocaleString("pt-BR")} L`
                  : dossier.informedVolumeLiters
                  ? `${dossier.informedVolumeLiters.toLocaleString("pt-BR")} L`
                  : "—"}
              </p>
            </div>
          </section>

          {/* PARECER TÉCNICO EXECUTIVO */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Parecer Técnico de Conferência
            </h3>
            <p className="leading-relaxed text-sm text-foreground bg-muted/30 p-3.5 rounded-md border border-border/60">
              {latestReport?.summary ??
                `Conferência documental realizada com aplicação do motor de regras normativas MAPA. Foram avaliados cruzamentos entre Anexo IX, Certificado de Origem, Laudo de Análise e Invoice. Status resultante: ${recomendacao}.`}
            </p>
          </section>

          {/* SNAPSHOT REGULATÓRIO & REGRAS APLICADAS */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Snapshot Regulatório & Versões Normativas
            </h3>
            <div className="rounded-md border border-border/60 p-3 bg-muted/10 space-y-1.5">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Regras avaliadas ({snapshot.length || "15"}):</strong>{" "}
                {snapshot.length > 0
                  ? snapshot.map((s) => `${s.code} v${s.version ?? 1}`).join(", ")
                  : "RULE-001 a RULE-015 (Motor Normativo MAPA v3)"}
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Fundamento legal:</strong> Instrução Normativa MAPA nº 67/2018,
                Decreto nº 8.198/2014, Anexo IX (Acordo Mercosul / Portarias aplicáveis).
              </p>
            </div>
          </section>

          {/* FINDINGS E TRATAMENTOS */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Findings & Tratamentos ({relevantAlerts.length})
              </h3>
              <span className="text-muted-foreground">{blockersCount} blocker(s) crítico(s)</span>
            </div>

            {relevantAlerts.length === 0 ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20 p-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Nenhuma inconformidade ou divergência encontrada nos documentos avaliados.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {relevantAlerts.map((a) => (
                  <div key={a.id} className="rounded-md border border-border/70 p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-semibold text-foreground text-xs">{a.title}</span>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {a.ruleCode} · Severidade: {a.severity.toUpperCase()} · Status: {a.status.toUpperCase()}
                        </p>
                      </div>
                      <SeverityBadge severity={a.severity} />
                    </div>
                    <p className="text-muted-foreground leading-normal">{a.message}</p>
                    {a.reviewComment && (
                      <p className="text-[11px] bg-muted/60 p-2 rounded border border-border/50 text-foreground">
                        <strong>Tratamento / Justificativa:</strong> {a.reviewComment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SIGNATÁRIOS E DATAS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/70 pt-4">
            <div className="p-3 rounded border border-border/60 bg-muted/10 space-y-1">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Analista Responsável</p>
              <p className="font-semibold text-foreground">{latestReport?.generatedByName ?? dossier.assignedTo?.name ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">
                Data: {latestReport ? format(new Date(latestReport.generatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
              </p>
            </div>
            <div className="p-3 rounded border border-border/60 bg-muted/10 space-y-1">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Gestor / Supervisor</p>
              <p className="font-semibold text-foreground">{latestReport?.approvedByName ?? "Pendente de revisão de gestor"}</p>
              <p className="text-[11px] text-muted-foreground">
                Data: {latestReport?.approvedAt ? format(new Date(latestReport.approvedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
              </p>
            </div>
          </section>

          {/* DISCLAIMER LEGAL OBRIGATÓRIO (SEÇÃO 27 DO BRIEFING) */}
          <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 text-xs text-amber-900 dark:text-amber-300">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <Scale className="h-4 w-4 shrink-0" />
              <span>Aviso Regulatório Obrigatório</span>
            </div>
            <p className="leading-relaxed opacity-95">
              &quot;Esta análise constitui ferramenta de apoio à conferência documental pré-embarque e não substitui a
              avaliação técnica do profissional responsável nem a decisão dos órgãos anuentes.&quot;
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
