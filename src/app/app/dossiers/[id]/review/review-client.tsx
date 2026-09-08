"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FileWarning, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AlertStatusBadge, SeverityBadge } from "@/components/domain/status-badge";
import {
  ALERT_SEVERITIES,
  ALERT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  SEVERITY_LABELS,
  type AlertSeverity,
  type AlertStatus,
  type DocumentType,
} from "@/lib/constants";
import { reviewAlert, requestComplementaryDocument } from "@/server/actions/alerts";
import { safeJsonParse } from "../format";

interface ReviewAlertData {
  id: string;
  ruleCode: string;
  ruleName: string;
  ruleDescription: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  recommendation: string | null;
  evidence: string | null;
  reviewComment: string | null;
  reviewedByName: string | null;
  createdAt: string;
}

function extractRelatedDocumentTypes(evidence: unknown): string[] {
  const found = new Set<string>();
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === "documentType" && typeof val === "string") found.add(val);
      if (key === "missingFrom" && Array.isArray(val)) val.forEach((v) => typeof v === "string" && found.add(v));
      walk(val);
    }
  }
  walk(evidence);
  return Array.from(found);
}

export function ReviewClient({
  dossier,
  documents,
  alerts,
}: {
  dossier: { id: string; internalNumber: string; brand: string; productName: string };
  documents: { id: string; documentType: string; filename: string }[];
  alerts: ReviewAlertData[];
}) {
  const router = useRouter();
  const [severityFilter, setSeverityFilter] = React.useState<string>("todas");
  const [documentFilter, setDocumentFilter] = React.useState<string>("todos");
  const [selectedId, setSelectedId] = React.useState<string | null>(alerts[0]?.id ?? null);
  const [comment, setComment] = React.useState("");
  const [pendingStatus, setPendingStatus] = React.useState<AlertStatus | null>(null);

  const documentTypesPresent = Array.from(new Set(documents.map((d) => d.documentType)));

  const filtered = alerts.filter((a) => {
    if (severityFilter !== "todas" && a.severity !== severityFilter) return false;
    if (documentFilter !== "todos") {
      const related = extractRelatedDocumentTypes(safeJsonParse(a.evidence));
      if (!related.includes(documentFilter)) return false;
    }
    return true;
  });

  const selected = alerts.find((a) => a.id === selectedId) ?? filtered[0] ?? null;
  const evidence = selected ? safeJsonParse<Record<string, unknown>>(selected.evidence) : null;

  React.useEffect(() => {
    setComment(selected?.reviewComment ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the selected alert changes, not on every comment edit
  }, [selected?.id]);

  async function handleAction(status: AlertStatus, severity?: AlertSeverity) {
    if (!selected) return;
    setPendingStatus(status);
    try {
      const result = await reviewAlert({ alertId: selected.id, status, severity, reviewComment: comment || undefined });
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível registrar a revisão.");
        return;
      }
      toast.success(`Alerta marcado como "${ALERT_STATUS_LABELS[status]}". Score recalculado: ${result.data?.score}/100.`);
      router.refresh();
    } finally {
      setPendingStatus(null);
    }
  }

  async function handleRequestDocument() {
    if (!selected) return;
    const result = await requestComplementaryDocument(selected.id);
    if (!result.ok) toast.error(result.error ?? "Falha ao solicitar documento.");
    else {
      toast.success("Documento complementar solicitado. Status do dossiê atualizado.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <Link href={`/app/dossiers/${dossier.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {dossier.internalNumber}
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Revisão de alertas</h1>
        <p className="text-sm text-muted-foreground">
          {dossier.brand} · {dossier.productName}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-8 text-xs">
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
            <Select value={documentFilter} onValueChange={setDocumentFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos documentos</SelectItem>
                {documentTypesPresent.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t as DocumentType] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <ShieldCheck className="h-7 w-7" />
                  <p className="text-sm">Nenhum alerta com esses filtros.</p>
                </CardContent>
              </Card>
            )}
            {filtered.map((alert) => (
              <button
                key={alert.id}
                onClick={() => setSelectedId(alert.id)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selected?.id === alert.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{alert.title}</p>
                  <SeverityBadge severity={alert.severity} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{alert.ruleCode}</p>
                <AlertStatusBadge status={alert.status} />
              </button>
            ))}
          </div>
        </div>

        <div>
          {!selected ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <FileWarning className="h-8 w-8" />
                <p className="text-sm">Selecione um alerta para revisar.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {selected.ruleCode} — {selected.ruleName}
                    </p>
                    <h2 className="text-lg font-semibold">{selected.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={selected.severity} />
                    <AlertStatusBadge status={selected.status} />
                  </div>
                </div>

                <p className="text-sm leading-relaxed">{selected.message}</p>

                {selected.recommendation && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugestão de correção</p>
                    <p className="mt-1">{selected.recommendation}</p>
                  </div>
                )}

                {evidence && Object.keys(evidence).length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidência</p>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                      {JSON.stringify(evidence, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição da regra</p>
                  <p className="text-sm text-muted-foreground">{selected.ruleDescription}</p>
                </div>

                {selected.reviewedByName && (
                  <p className="text-xs text-muted-foreground">
                    Última revisão por {selected.reviewedByName}
                    {selected.reviewComment ? ` — "${selected.reviewComment}"` : ""}
                  </p>
                )}

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comentário do analista</p>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Justifique a decisão (ex.: divergência explicada pela safra constar no rótulo)…"
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={pendingStatus !== null} onClick={() => handleAction("confirmado")}>
                      Confirmar alerta
                    </Button>
                    <Button size="sm" variant="outline" disabled={pendingStatus !== null} onClick={() => handleAction("resolvido")}>
                      Marcar como resolvido
                    </Button>
                    <Button size="sm" variant="outline" disabled={pendingStatus !== null} onClick={() => handleAction("falso_positivo")}>
                      Falso positivo
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pendingStatus !== null} onClick={() => handleAction("rejeitado")}>
                      Rejeitar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleRequestDocument}>
                      Solicitar documento complementar
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-xs text-muted-foreground">Reatribuir severidade:</span>
                    <Select onValueChange={(v) => handleAction((selected.status as AlertStatus) ?? "aberto", v as AlertSeverity)}>
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder={SEVERITY_LABELS[selected.severity as AlertSeverity]} />
                      </SelectTrigger>
                      <SelectContent>
                        {ALERT_SEVERITIES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SEVERITY_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Criado em {format(new Date(selected.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
