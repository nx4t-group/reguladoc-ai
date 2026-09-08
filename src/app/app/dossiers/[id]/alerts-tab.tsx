"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertStatusBadge, SeverityBadge } from "@/components/domain/status-badge";
import { ALERT_SEVERITIES, SEVERITY_LABELS } from "@/lib/constants";
import { generateAlertVariations } from "@/server/actions/alerts";
import type { AlertData } from "./types";

export function AlertsTab({ dossierId, alerts }: { dossierId: string; alerts: AlertData[] }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [severityFilter, setSeverityFilter] = React.useState<string>("todas");

  const filtered = severityFilter === "todas" ? alerts : alerts.filter((a) => a.severity === severityFilter);
  const openCount = alerts.filter((a) => a.status === "aberto" || a.status === "confirmado").length;

  function handleSimulate() {
    startTransition(async () => {
      const res = await generateAlertVariations(dossierId);
      if (res.ok) {
        toast.success("Variações de alertas de simulação geradas!");
        router.refresh();
      } else {
        toast.error(res.error ?? "Falha ao gerar variações de alertas.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="text-sm">Alertas ({alerts.length})</CardTitle>
          <p className="text-xs text-muted-foreground">{openCount} em aberto ou confirmados aguardando decisão</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={isPending} onClick={handleSimulate} className="border-primary/30 text-primary hover:bg-primary/5">
            <Sparkles className="mr-1 h-3.5 w-3.5 animate-pulse" />
            {isPending ? "Gerando..." : "Gerar Alertas de Simulação"}
          </Button>
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
            <Link href={`/app/dossiers/${dossierId}/review`}>Ir para revisão</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <ShieldCheck className="h-8 w-8" />
            <p className="text-sm">Nenhum alerta{severityFilter !== "todas" ? " nesta severidade" : ""}.</p>
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
