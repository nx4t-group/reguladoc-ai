"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DossierStatusBadge, SeverityBadge } from "@/components/domain/status-badge";
import { scoreClassification } from "@/lib/constants";
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
  const classification = dossier.complianceScore != null ? scoreClassification(dossier.complianceScore) : null;
  const snapshot = latestRun ? safeJsonParse<{ code: string; version?: number }[]>(latestRun.rulesVersionSnapshot) ?? [] : [];

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateReport(dossier.id);
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível gerar o parecer.");
        return;
      }
      toast.success("Parecer gerado.");
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  if (!latestReport && dossier.complianceScore == null) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Execute a validação do dossiê antes de gerar o parecer de conformidade.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-end gap-2">
        <Button variant="outline" onClick={handleGenerate} disabled={generating}>
          {generating ? "Gerando…" : latestReport ? "Regerar parecer" : "Gerar parecer"}
        </Button>
        <Button onClick={() => window.print()} disabled={!latestReport}>
          <Printer className="h-4 w-4" /> Exportar / Imprimir PDF
        </Button>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Parecer de Conformidade Documental</CardTitle>
              <p className="text-sm text-muted-foreground">
                Dossiê {dossier.internalNumber} — {dossier.productName} ({dossier.brand})
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{dossier.complianceScore ?? "—"}/100</p>
              {classification && (
                <Badge variant={classification.tone === "destructive" ? "destructive" : classification.tone === "success" ? "success" : "warning"}>
                  {classification.label}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo executivo</h3>
            <p className="text-sm leading-relaxed">
              {latestReport?.summary ??
                `Score de conformidade calculado em ${dossier.complianceScore}/100 (${classification?.label}). Este parecer é gerado automaticamente pelo motor de regras e não substitui a análise do especialista humano — aprovação final exige revisão registrada (RULE-014).`}
            </p>
          </section>

          <Separator />

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status geral</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">Status do dossiê</p>
                <DossierStatusBadge status={dossier.status} />
              </div>
              <div>
                <p className="text-muted-foreground">Versão das regras aplicadas</p>
                <p className="font-medium">{snapshot.length} regra(s) — {snapshot.map((s) => s.code).join(", ") || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Responsável pela revisão</p>
                <p className="font-medium">{dossier.assignedTo?.name ?? "Não atribuído"}</p>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Inconsistências encontradas ({relevantAlerts.length})
            </h3>
            {relevantAlerts.length === 0 ? (
              <p className="text-sm text-status-success">Nenhuma inconsistência identificada nesta execução.</p>
            ) : (
              <div className="space-y-2">
                {relevantAlerts.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 text-sm">
                    <div>
                      <p className="font-medium">
                        {a.ruleCode} — {a.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.message}</p>
                      {a.reviewComment && <p className="mt-1 text-xs italic text-muted-foreground">Revisão: {a.reviewComment}</p>}
                    </div>
                    <SeverityBadge severity={a.severity} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          <section className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Emitido por</p>
              <p className="font-medium">{latestReport?.generatedByName ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {latestReport ? format(new Date(latestReport.generatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Aprovado por</p>
              <p className="font-medium">{latestReport?.approvedByName ?? "Pendente de revisão humana"}</p>
              <p className="text-xs text-muted-foreground">
                {latestReport?.approvedAt ? format(new Date(latestReport.approvedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
