"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  AlertCircle,
  ShieldCheck,
  UploadCloud,
  History,
  Scale,
} from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertStatusBadge, DossierStatusBadge, SeverityBadge } from "@/components/domain/status-badge";
import {
  ALERT_SEVERITIES,
  DOCUMENT_TYPE_LABELS,
  MANDATORY_LEGAL_DISCLAIMER,
  REQUIRED_DOCUMENT_TYPES,
  SEVERITY_LABELS,
  type DocumentType,
  type Role,
} from "@/lib/constants";
import { recordFindingAction } from "@/server/actions/alerts";
import { uploadDocument } from "@/server/actions/documents";
import { safeJsonParse } from "../format";

export interface ReviewClientProps {
  embedded?: boolean;
  tenantRole: Role;
  dossier: {
    id: string;
    internalNumber: string;
    brand: string;
    productName: string;
    status: string;
    complianceScore: number | null;
    items: {
      id: string;
      itemNumber: number;
      productName: string;
      brand: string;
      batchNumber: string | null;
      packageCount: number | null;
      totalVolumeLiters: number | null;
    }[];
  };
  documents: {
    id: string;
    documentType: string;
    filename: string;
    checksum: string;
    currentVersion: number;
    extractionStatus: string;
    confidenceScore: number | null;
    versionsCount: number;
  }[];
  extractedFields: {
    id: string;
    documentId: string;
    fieldKey: string;
    fieldValue: string;
    confidence: number;
  }[];
  alerts: {
    id: string;
    ruleCode: string;
    ruleName: string;
    ruleDescription: string;
    sourceReference: string | null;
    severity: string;
    status: string;
    title: string;
    message: string;
    recommendation: string | null;
    evidence: string | null;
    reviewComment: string | null;
    reviewedByName: string | null;
    createdAt: string;
    actions: {
      id: string;
      actionType: string;
      reason: string;
      previousStatus: string | null;
      newStatus: string;
      createdAt: string;
    }[];
  }[];
}

export function ReviewClient({
  embedded = false,
  tenantRole,
  dossier,
  documents,
  extractedFields,
  alerts,
}: ReviewClientProps) {
  const router = useRouter();
  void tenantRole;

  // Filtros e seleção
  const [severityFilter, setSeverityFilter] = React.useState<string>("todas");
  const [selectedAlertId, setSelectedAlertId] = React.useState<string | null>(alerts[0]?.id ?? null);
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(documents[0]?.id ?? null);
  const [leftTab, setLeftTab] = React.useState<"checklist" | "items">("checklist");
  const [centerTab, setCenterTab] = React.useState<"fields" | "evidence">("fields");

  // Ação sobre o alerta selecionado
  const [actionReason, setActionReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Upload rápido
  const quickUploadRef = React.useRef<HTMLInputElement>(null);
  const [quickUploadType, setQuickUploadType] = React.useState<string>("auto");

  // Alerta selecionado
  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== "todas" && a.severity !== severityFilter) return false;
    return true;
  });

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) ?? filteredAlerts[0] ?? null;
  const parsedEvidence = selectedAlert ? safeJsonParse<Record<string, unknown>>(selectedAlert.evidence) : null;

  // Documento selecionado no visualizador
  const selectedDoc = documents.find((d) => d.id === selectedDocId) ?? documents[0] ?? null;
  const docFields = selectedDoc ? extractedFields.filter((f) => f.documentId === selectedDoc.id) : [];

  React.useEffect(() => {
    setActionReason(selectedAlert?.reviewComment ?? "");
  }, [selectedAlert?.id, selectedAlert?.reviewComment]);

  async function handleFindingAction(actionType: "CONFIRMAR" | "FALSO_POSITIVO" | "JUSTIFICATIVA_TECNICA" | "AGUARDANDO_DOCUMENTO") {
    if (!selectedAlert) return;
    if (["FALSO_POSITIVO", "JUSTIFICATIVA_TECNICA"].includes(actionType) && (!actionReason || actionReason.trim().length < 5)) {
      toast.error("Justificativa técnica obrigatória (mínimo de 5 caracteres) para resolver a inconformidade.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordFindingAction({
        alertId: selectedAlert.id,
        actionType,
        reason: actionReason || "Ação confirmada pelo analista",
      });

      if (!res.ok) {
        toast.error(res.error ?? "Erro ao registrar ação.");
        return;
      }

      toast.success(`Ação [${actionType}] registrada com sucesso!`);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuickUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("dossierId", dossier.id);
    if (quickUploadType !== "auto") {
      formData.set("documentType", quickUploadType);
    }
    formData.set("file", file);

    const toastId = toast.loading(`Enviando ${file.name} e reprocessando…`);
    try {
      const res = await uploadDocument(formData);
      if (!res.ok) {
        toast.error(res.error ?? "Falha no upload.", { id: toastId });
        return;
      }
      toast.success("Documento enviado e classificado com sucesso! Validação atualizada.", { id: toastId });
      router.refresh();
    } finally {
      if (quickUploadRef.current) quickUploadRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 pb-8">
      {/* Barra de Título Superior (apenas quando não embutido) */}
      {!embedded && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link href={`/app/dossiers/${dossier.id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">{dossier.internalNumber}</h1>
                <DossierStatusBadge status={dossier.status} />
                {dossier.complianceScore != null && (
                  <Badge variant={dossier.complianceScore >= 90 ? "success" : "warning"} className="font-mono text-xs">
                    Score: {dossier.complianceScore}/100
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {dossier.brand} · {dossier.productName} · Workspace de Decisão Técnica Pré-Embarque
              </p>
            </div>
          </div>

          {/* Disclaimer Legal Obrigatório em Banner Compacto */}
          <div className="max-w-md rounded border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-1.5 font-semibold">
              <Scale className="h-3.5 w-3.5 shrink-0" />
              <span>Apoio à Decisão Operacional</span>
            </div>
            <p className="mt-0.5 line-clamp-1 hover:line-clamp-none text-[10px] opacity-90 transition-all">
              {MANDATORY_LEGAL_DISCLAIMER}
            </p>
          </div>
        </div>
      )}

      {/* Grid de 3 Painéis Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_420px] gap-4 min-h-[720px]">
        {/* =========================================================================
            PAINEL 1 (ESQUERDO): Itens & Checklist Documental
           ========================================================================= */}
        <Card className="flex flex-col border-border/80 shadow-sm">
          <CardHeader className="p-3 border-b border-border/60 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 bg-muted p-0.5 rounded">
                <button
                  onClick={() => setLeftTab("checklist")}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    leftTab === "checklist" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Checklist ({documents.length}/{REQUIRED_DOCUMENT_TYPES.length})
                </button>
                <button
                  onClick={() => setLeftTab("items")}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    leftTab === "items" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Itens ({dossier.items.length || 1})
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
            {leftTab === "checklist" ? (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Documentos Obrigatórios
                </p>
                {REQUIRED_DOCUMENT_TYPES.map((reqType) => {
                  const doc = documents.find((d) => d.documentType === reqType);
                  const isSelected = doc && selectedDoc?.id === doc.id;

                  return (
                    <div
                      key={reqType}
                      onClick={() => {
                        if (doc) setSelectedDocId(doc.id);
                        else {
                          setQuickUploadType(reqType);
                          quickUploadRef.current?.click();
                        }
                      }}
                      className={`group flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : doc
                          ? "border-border hover:bg-muted/40"
                          : "border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10 hover:border-amber-400"
                      }`}
                    >
                      {doc ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium truncate">{DOCUMENT_TYPE_LABELS[reqType]}</span>
                          {doc && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">
                              v{doc.currentVersion}
                            </Badge>
                          )}
                        </div>
                        {doc ? (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {doc.filename}
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium">
                            Pendente · Clique p/ anexar
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Documentos complementares / adicionais */}
                {documents.filter((d) => !REQUIRED_DOCUMENT_TYPES.includes(d.documentType as DocumentType)).length > 0 && (
                  <div className="pt-2 border-t border-border/60">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                      Outros Documentos
                    </p>
                    {documents
                      .filter((d) => !REQUIRED_DOCUMENT_TYPES.includes(d.documentType as DocumentType))
                      .map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedDocId(doc.id)}
                          className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer mb-1 ${
                            selectedDoc?.id === doc.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{doc.filename}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            v{doc.currentVersion}
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Itens Cadastrados no Dossiê
                </p>
                {dossier.items.length === 0 ? (
                  <div className="p-3 rounded border border-border text-xs bg-muted/20">
                    <p className="font-medium">{dossier.productName}</p>
                    <p className="text-muted-foreground mt-1">Marca: {dossier.brand}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Item único (padrão)</p>
                  </div>
                ) : (
                  dossier.items.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-lg border border-border text-xs space-y-1 bg-card">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">Item #{item.itemNumber}</span>
                        {item.batchNumber && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            Lote: {item.batchNumber}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-muted-foreground">Marca: {item.brand}</p>
                      {item.totalVolumeLiters && (
                        <p className="text-muted-foreground">Volume: {item.totalVolumeLiters} L</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>

          {/* Rodapé do Painel 1: Upload Rápido */}
          <div className="p-3 border-t border-border/60 bg-muted/10">
            <input
              ref={quickUploadRef}
              type="file"
              className="hidden"
              onChange={handleQuickUpload}
              accept=".pdf,.png,.jpg,.jpeg,.docx"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={() => {
                setQuickUploadType("auto");
                quickUploadRef.current?.click();
              }}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Upload Inteligente (Auto-detect)
            </Button>
          </div>
        </Card>

        {/* =========================================================================
            PAINEL 2 (CENTRAL): Visualizador & Evidências Extraídas
           ========================================================================= */}
        <Card className="flex flex-col border-border/80 shadow-sm">
          <CardHeader className="p-3 border-b border-border/60 bg-muted/20">
            {selectedDoc ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate max-w-sm">{selectedDoc.filename}</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {DOCUMENT_TYPE_LABELS[selectedDoc.documentType as DocumentType] ?? selectedDoc.documentType}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      Versão {selectedDoc.currentVersion}
                    </Badge>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                    SHA-256: {selectedDoc.checksum}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-muted p-0.5 rounded">
                  <button
                    onClick={() => setCenterTab("fields")}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      centerTab === "fields" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Campos ({docFields.length})
                  </button>
                  <button
                    onClick={() => setCenterTab("evidence")}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      centerTab === "evidence" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Contexto da Evidência
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">Visualizador de Documentos</span>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4">
            {!selectedDoc ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-20">
                <FileText className="h-10 w-10 stroke-1" />
                <p className="text-sm">Selecione um documento no checklist ao lado para visualizar.</p>
              </div>
            ) : centerTab === "fields" ? (
              <div className="space-y-3">
                {docFields.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nenhum campo estruturado extraído deste documento ainda.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {docFields.map((field) => {
                      // Verifica se o campo está envolvido na inconsistência atualmente selecionada
                      const isHighlighted =
                        selectedAlert &&
                        (selectedAlert.title.toLowerCase().includes(field.fieldKey.toLowerCase()) ||
                          selectedAlert.message.toLowerCase().includes(field.fieldValue.toLowerCase()));

                      return (
                        <div
                          key={field.id}
                          className={`p-3 rounded-lg border text-xs transition-all ${
                            isHighlighted
                              ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
                              : "border-border bg-muted/10 hover:bg-muted/20"
                          }`}
                        >
                          <div className="flex items-center justify-between text-muted-foreground mb-1">
                            <span className="font-mono uppercase text-[10px] tracking-wider">{field.fieldKey}</span>
                            <span className="text-[10px] font-mono">{Math.round(field.confidence * 100)}% conf.</span>
                          </div>
                          <p className="font-semibold text-sm break-all">{field.fieldValue}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs">
                  <p className="font-semibold text-xs mb-1">Rastreabilidade Documental do Arquivo</p>
                  <p className="text-muted-foreground">
                    Este documento está versionado como <strong>v{selectedDoc.currentVersion}</strong>.
                    Substituições de documento preservam integridade e auditoria com SHA-256.
                  </p>
                  <p className="font-mono text-[11px] mt-2 text-primary">{selectedDoc.checksum}</p>
                </div>
                {parsedEvidence && (
                  <div className="p-3 rounded-lg border border-border bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto">
                    <p className="text-[10px] text-zinc-400 mb-2 font-sans font-semibold">
                      Evidência Bruta Relacionada ao Alerta Selecionado:
                    </p>
                    <pre className="text-[11px] leading-relaxed">{JSON.stringify(parsedEvidence, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* =========================================================================
            PAINEL 3 (DIREITO): Inconformidades, Conferência & Auditoria
           ========================================================================= */}
        <Card className="flex flex-col border-border/80 shadow-sm">
          <CardHeader className="p-3 border-b border-border/60 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">Inconformidades ({alerts.length})</CardTitle>
                <p className="text-[11px] text-muted-foreground">Divergências detectadas e decisão técnica</p>
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {ALERT_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEVERITY_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Lista compacta de alertas para seleção rápida */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredAlerts.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <ShieldCheck className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                  Nenhuma inconformidade em aberto.
                </div>
              ) : (
                filteredAlerts.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAlertId(a.id)}
                    className={`p-2 rounded border text-xs cursor-pointer transition-all ${
                      selectedAlert?.id === a.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-semibold truncate">{a.title}</span>
                      <SeverityBadge severity={a.severity} />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                      <span className="font-mono">{a.ruleCode}</span>
                      <AlertStatusBadge status={a.status} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Detalhes do Alerta Selecionado com Divergência Lado a Lado */}
            {selectedAlert && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-3 pt-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-xs leading-snug">{selectedAlert.title}</h3>
                    <AlertStatusBadge status={selectedAlert.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-mono text-muted-foreground">{selectedAlert.ruleCode}</span>
                    {selectedAlert.sourceReference && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {selectedAlert.sourceReference}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{selectedAlert.message}</p>
                </div>

                {/* Comparação Lado a Lado das Evidências Divergentes */}
                {parsedEvidence && (
                  <div className="rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 text-xs space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                      Evidências em Confronto
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground block">Esperado / Referência:</span>
                        <strong className="text-emerald-700 dark:text-emerald-400 break-all">
                          {typeof parsedEvidence.expected === "object"
                            ? JSON.stringify(parsedEvidence.expected)
                            : String(parsedEvidence.expected ?? parsedEvidence.calculated ?? "Padrão regulatório")}
                        </strong>
                      </div>
                      <div className="p-2 rounded bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground block">Detectado / Divergente:</span>
                        <strong className="text-destructive break-all">
                          {typeof parsedEvidence.actual === "object"
                            ? JSON.stringify(parsedEvidence.actual)
                            : String(parsedEvidence.actual ?? parsedEvidence.informedVolumeLiters ?? parsedEvidence.missingFrom ?? "Inconsistente")}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Justificativa Técnica Obrigatória */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold flex items-center justify-between">
                    <span>Justificativa Técnica do Analista</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Obrigatória para resolver</span>
                  </label>
                  <Textarea
                    placeholder="Descreva o fundamento técnico ou normativo que respalda esta decisão..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="h-16 text-xs resize-none"
                  />
                </div>

                {/* Botões de Ação Regulamentar */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    disabled={isSubmitting}
                    onClick={() => handleFindingAction("JUSTIFICATIVA_TECNICA")}
                  >
                    Aceitar Justificativa
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    disabled={isSubmitting}
                    onClick={() => handleFindingAction("FALSO_POSITIVO")}
                  >
                    Falso Positivo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 text-amber-700 dark:text-amber-400"
                    disabled={isSubmitting}
                    onClick={() => handleFindingAction("AGUARDANDO_DOCUMENTO")}
                  >
                    Aguardar Documento
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs h-8"
                    disabled={isSubmitting}
                    onClick={() => handleFindingAction("CONFIRMAR")}
                  >
                    Confirmar Bloqueio
                  </Button>
                </div>

                {/* Histórico Append-Only de Ações */}
                {selectedAlert.actions.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <History className="h-3 w-3" /> Histórico de Decisões do Alerta
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedAlert.actions.map((act) => (
                        <div key={act.id} className="p-1.5 rounded bg-muted/20 border border-border/50 text-[10px]">
                          <div className="flex items-center justify-between font-mono">
                            <span className="font-semibold text-primary">{act.actionType}</span>
                            <span className="text-muted-foreground">{format(new Date(act.createdAt), "dd/MM HH:mm")}</span>
                          </div>
                          <p className="text-muted-foreground mt-0.5 line-clamp-2">{act.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
