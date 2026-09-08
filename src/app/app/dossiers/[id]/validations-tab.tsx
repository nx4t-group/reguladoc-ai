import { CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/domain/status-badge";
import { scoreClassification } from "@/lib/constants";
import { safeJsonParse } from "./format";
import type { AlertData, RuleSummary, ValidationRunData } from "./types";

export function ValidationsTab({
  validationRuns,
  alerts,
  allRules,
}: {
  validationRuns: ValidationRunData[];
  alerts: AlertData[];
  allRules: RuleSummary[];
}) {
  if (validationRuns.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma validação executada ainda. Use o botão &quot;Executar validação&quot; no topo da página.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {validationRuns.map((run) => {
        const snapshot = safeJsonParse<{ code: string; version?: number; name?: string }[]>(run.rulesVersionSnapshot) ?? [];
        const runAlerts = alerts.filter((a) => a.validationRunId === run.id);
        const classification = run.score != null ? scoreClassification(run.score) : null;

        return (
          <Card key={run.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">
                  Execução de {format(new Date(run.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{snapshot.length} regra(s) avaliada(s) nesta execução</p>
              </div>
              <div className="flex items-center gap-2">
                {run.score != null && <span className="text-sm font-semibold">{run.score}/100</span>}
                {classification && <Badge variant={classification.tone === "destructive" ? "destructive" : classification.tone === "success" ? "success" : "warning"}>{classification.label}</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {snapshot.map((ruleRef) => {
                  const finding = runAlerts.find((a) => a.ruleCode === ruleRef.code);
                  const ruleMeta = allRules.find((r) => r.code === ruleRef.code);
                  return (
                    <div key={ruleRef.code} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="flex items-start gap-2.5">
                        {finding ? (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-severity-critical" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {ruleRef.code} — {ruleMeta?.name ?? ruleRef.name ?? finding?.ruleName}
                          </p>
                          {finding && <p className="text-xs text-muted-foreground">{finding.message}</p>}
                          {!finding && <p className="text-xs text-status-success">Sem inconsistências encontradas.</p>}
                        </div>
                      </div>
                      {finding && <SeverityBadge severity={finding.severity} />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
