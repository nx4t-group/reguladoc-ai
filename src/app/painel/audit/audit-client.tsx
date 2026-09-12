"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  History,
  FilePlus2,
  FileSearch,
  PlayCircle,
  ShieldAlert,
  CheckCircle2,
  Tag,
  ThumbsDown,
  FileBarChart,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AuditEventItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  dossierInternalNumber: string | null;
  dossierBrand: string | null;
  userName: string;
  userEmail: string | null;
  ipAddress: string | null;
  createdAt: string;
  beforeJson: string | null;
  afterJson: string | null;
  metadataJson: string | null;
}

const ACTION_MAP: Record<string, { label: string; icon: typeof History; badgeVariant: "neutral" | "info" | "warning" | "success" | "destructive" }> = {
  dossie_criado: { label: "Dossiê criado", icon: FilePlus2, badgeVariant: "info" },
  dossie_atualizado: { label: "Dossiê atualizado", icon: History, badgeVariant: "neutral" },
  status_alterado: { label: "Status alterado", icon: History, badgeVariant: "neutral" },
  documento_enviado: { label: "Documento anexado", icon: FilePlus2, badgeVariant: "info" },
  tipo_documental_alterado: { label: "Classificação alterada", icon: Tag, badgeVariant: "warning" },
  extracao_executada: { label: "Extração OCR / IA executada", icon: FileSearch, badgeVariant: "info" },
  validacao_executada: { label: "Validação do motor de regras", icon: PlayCircle, badgeVariant: "info" },
  alerta_gerado: { label: "Inconformidade / Finding detectado", icon: ShieldAlert, badgeVariant: "destructive" },
  alerta_revisado: { label: "Finding tratado por especialista", icon: CheckCircle2, badgeVariant: "success" },
  regra_alterada: { label: "Versão de regra alterada", icon: Tag, badgeVariant: "warning" },
  parecer_gerado: { label: "Parecer técnico gerado", icon: FileBarChart, badgeVariant: "info" },
  usuario_aprovou: { label: "Decisão: Recomendado p/ liberação", icon: CheckCircle2, badgeVariant: "success" },
  usuario_rejeitou: { label: "Decisão: Não recomendado", icon: ThumbsDown, badgeVariant: "destructive" },
  relatorio_emitido: { label: "Relatório de conferência emitido", icon: FileBarChart, badgeVariant: "success" },
};

export function AuditLogClient({ events }: { events: AuditEventItem[] }) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedAction, setSelectedAction] = React.useState("todas");
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredEvents = React.useMemo(() => {
    return events.filter((e) => {
      if (selectedAction !== "todas" && e.action !== selectedAction) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        e.action.toLowerCase().includes(term) ||
        (e.dossierInternalNumber && e.dossierInternalNumber.toLowerCase().includes(term)) ||
        (e.dossierBrand && e.dossierBrand.toLowerCase().includes(term)) ||
        e.userName.toLowerCase().includes(term)
      );
    });
  }, [events, searchTerm, selectedAction]);

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-[17px] font-semibold">Eventos auditados ({filteredEvents.length})</CardTitle>
          <CardDescription className="text-[13px]">Trilha detalhada e protegida contra exclusão.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por dossiê, usuário ou ação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-8 text-xs"
            />
          </div>
          <Select value={selectedAction} onValueChange={setSelectedAction}>
            <SelectTrigger className="h-9 w-52 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder="Todas as ações" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as ações</SelectItem>
              {Object.entries(ACTION_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {val.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border/60 p-0">
        {filteredEvents.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum evento corresponde aos filtros aplicados.
          </div>
        )}
        {filteredEvents.map((e) => {
          const info = ACTION_MAP[e.action] ?? {
            label: e.action.replace(/_/g, " "),
            icon: History,
            badgeVariant: "neutral" as const,
          };
          const Icon = info.icon;
          const isExpanded = expandedIds.has(e.id);
          const hasDetails = !!(e.beforeJson || e.afterJson || e.metadataJson);

          return (
            <div key={e.id} className="relative flex gap-4 p-4 transition-colors hover:bg-muted/40 group">
              {/* Linha vertical de timeline */}
              <div className="absolute left-[38px] top-[56px] bottom-0 w-px bg-border/60 group-last:hidden" />

              <div className={
                `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  info.badgeVariant === "success" ? "bg-status-success/15 text-status-success" :
                  info.badgeVariant === "destructive" ? "bg-severity-critical/15 text-severity-critical" :
                  info.badgeVariant === "warning" ? "bg-status-warning/15 text-status-warning" :
                  info.badgeVariant === "info" ? "bg-severity-low/15 text-severity-low" :
                  "bg-muted text-muted-foreground"
                }`
              }>
                <Icon className="h-4.5 w-4.5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-foreground">{info.label}</span>
                      {e.dossierInternalNumber && (
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {e.dossierInternalNumber} {e.dossierBrand ? `· ${e.dossierBrand}` : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      Por <span className="font-medium text-foreground">{e.userName}</span>
                      {e.userEmail ? ` (${e.userEmail})` : ""} · {format(new Date(e.createdAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      {e.ipAddress && ` · IP: ${e.ipAddress}`}
                    </p>
                  </div>
                  {hasDetails && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-[12px] text-muted-foreground shrink-0"
                      onClick={() => toggleExpand(e.id)}
                    >
                      {isExpanded ? "Ocultar detalhes" : "Ver payload"}
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>

                {isExpanded && hasDetails && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-muted/70 p-3 text-xs sm:grid-cols-2">
                    {e.beforeJson && (
                      <div>
                        <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Antes (Estado Prévio)</p>
                        <pre className="max-h-40 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-foreground">
                          {e.beforeJson}
                        </pre>
                      </div>
                    )}
                    {e.afterJson && (
                      <div>
                        <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Depois (Estado Resultante)</p>
                        <pre className="max-h-40 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-foreground">
                          {e.afterJson}
                        </pre>
                      </div>
                    )}
                    {e.metadataJson && (
                      <div className="sm:col-span-2">
                        <p className="mb-1 font-semibold uppercase text-muted-foreground text-[10px]">Metadados & Snapshot</p>
                        <pre className="max-h-40 overflow-auto rounded bg-background p-2 font-mono text-[11px] text-foreground">
                          {e.metadataJson}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
