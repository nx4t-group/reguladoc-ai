"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertStatusBadge, SeverityBadge } from "@/components/domain/status-badge";
import { ALERT_SEVERITIES, SEVERITY_LABELS } from "@/lib/constants";
import type { AlertData } from "./types";

export function AlertsTab({ dossierId, alerts }: { dossierId: string; alerts: AlertData[] }) {
  const [severityFilter, setSeverityFilter] = React.useState<string>("todas");

  const filtered = severityFilter === "todas" ? alerts : alerts.filter((a) => a.severity === severityFilter);
  const openCount = alerts.filter((a) => a.status === "aberto" || a.status === "confirmado").length;

  return (
    <Card>
      <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="text-sm font-semibold">Inconformidades & Alertas ({alerts.length})</CardTitle>
          <p className="text-xs text-muted-foreground">{openCount} em aberto ou confirmados aguardando justificativa/decisão</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas severidades</SelectItem>
              {ALERT_SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" asChild>
            <Link href={`/painel/dossiers/${dossierId}/review`}>Abrir Workspace de Decisão</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">Nenhuma inconformidade detectada{severityFilter !== "todas" ? " nesta severidade" : ""}.</p>
          </div>
        )}
        {filtered.map((alert) => (
          <div key={alert.id} className="rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-muted-foreground">
                  {alert.ruleCode} — {alert.ruleName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <SeverityBadge severity={alert.severity} />
                <AlertStatusBadge status={alert.status} />
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{alert.message}</p>
            {alert.recommendation && (
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800/40">
                <strong>Ação Recomendada:</strong> {alert.recommendation}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

