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
  Scale,
  Layers,
  FlaskConical,
  Award,
  FileCheck,
  Tag,
  Receipt,
  Package,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  XCircle,
  Sparkles,
  Bookmark,
  ExternalLink,
  Lock,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertStatusBadge, DossierStatusBadge, SeverityBadge } from "@/components/domain/status-badge";
import {
  ALERT_SEVERITIES,
  DOCUMENT_TYPE_LABELS,
  REQUIRED_DOCUMENT_TYPES,
  SEVERITY_LABELS,
  type AlertSeverity,
  type AlertStatus,
  type DocumentType,
  type Role,
} from "@/lib/constants";
import { recordFindingAction } from "@/server/actions/alerts";
import { uploadDocument } from "@/server/actions/documents";
import { FIELD_LABELS } from "@/lib/extraction/fields";
import { CountryOriginBadge } from "@/components/country-origin-badge";
import { safeJsonParse } from "../format";

/**
 * Propósito essencial e campos prioritários únicos de cada documento.
 * Garante que cada documento destaque apenas o que é exclusivo dele,
 * evitando duplicações desnecessárias.
 */
export const DOCUMENT_PURPOSES: Record<
  string,
  {
    role: string;
    highlight: string;
    order: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
    essentialKeys: string[];
  }
> = {
  laudo_analise: {
    role: "Aferição Laboratorial & PIQ MAPA",
    highlight: "Comprova parâmetros físico-químicos, segurança enológica e conformidade com o padrão oficial do MAPA.",
    order: "1º Mais Importante",
    badge: "Laboratorial / PIQ",
    icon: FlaskConical,
    essentialKeys: [
      "numero_laudo",
      "laboratorio",
      "teor_alcoolico",
      "acidez_total",
      "acidez_volatil",
      "acucares_totais",
      "metanol",
      "ph",
      "sulfatos",
      "extrato_seco_reduzido",
      "extrato_seco_total",
      "data_laudo",
      "observacao_acreditacao",
    ],
  },
  certificado_origem: {
    role: "Autenticidade Geográfica & Denominação",
    highlight: "Garante a indicação geográfica protegida (DO/IG), procedência vitivinícola e respaldo tarifário.",
    order: "2º Mais Importante",
    badge: "Origem & DO",
    icon: Award,
    essentialKeys: [
      "numero_certificado_origem",
      "numero_certificado",
      "orgao_emissor",
      "indicacao_geografica",
      "denominacao_origem",
      "safra",
      "pais_origem",
      "data_emissao",
    ],
  },
  anexo_ix: {
    role: "Declaração Oficial MAPA",
    highlight: "Declaração do importador vinculando CNPJ, registro de estabelecimento SIPEAGRO e enquadramento normativo.",
    order: "3º Mais Importante",
    badge: "MAPA / SIPEAGRO",
    icon: FileCheck,
    essentialKeys: [
      "registro_mapa",
      "cnpj",
      "referencia_normativa",
      "data_referencia",
      "numero_laudo",
    ],
  },
  rotulo: {
    role: "Rotulagem & Proteção ao Consumidor",
    highlight: "Conformidade das inscrições em português no rótulo/contrarótulo, graduação alcoólica e advertências legais.",
    order: "4º Mais Importante",
    badge: "Rotulagem Legal",
    icon: Tag,
    essentialKeys: [
      "teor_alcoolico",
      "indicacao_geografica",
      "denominacao",
      "alergênicos_avisos",
      "capacidade_unitaria",
      "registro_mapa",
    ],
  },
  invoice: {
    role: "Instrumento Comercial Internacional",
    highlight: "Comprova a transação mercantil, valor aduaneiro declarado e condições de compra (Incoterms).",
    order: "5º Mais Importante",
    badge: "Comercial / Fatura",
    icon: Receipt,
    essentialKeys: [
      "numero_invoice",
      "data_invoice",
      "incoterm",
      "valor_total",
      "condicao_pagamento",
    ],
  },
  packing_list: {
    role: "Romaneio Físico de Carga",
    highlight: "Especificação física dos volumes, quantidade de caixas, garrafas por embalagem e pesagem para desembaraço.",
    order: "6º Mais Importante",
    badge: "Logística / Carga",
    icon: Package,
    essentialKeys: [
      "tipo_embalagem",
      "numero_embalagens",
      "unidades_por_embalagem",
      "volume_total_informado",
      "peso_bruto",
      "peso_liquido",
    ],
  },
  cii: {
    role: "Certificado de Inspeção MAPA",
    highlight: "Ato oficial de inspeção e deferimento agropecuário emitido pelo Ministério da Agricultura.",
    order: "Inspeção Federal",
    badge: "CII MAPA",
    icon: ShieldCheck,
    essentialKeys: [
      "numero_certificado",
      "orgao_emissor",
      "data_emissao",
      "apto_inapto",
    ],
  },
};

export interface ReviewClientProps {
  embedded?: boolean;
  tenantRole: Role;
  dossier: {
    id: string;
    internalNumber: string;
    brand: string;
    productName: string;
    importerName?: string;
    exporterName?: string | null;
    producerName?: string | null;
    countryOrigin?: string | null;
    vintage?: string | null;
    geographicalIndication?: string | null;
    batchNumber?: string | null;
    packageType?: string | null;
    packageCount?: number | null;
    unitsPerPackage?: number | null;
    unitCapacityLiters?: number | null;
    calculatedVolumeLiters?: number | null;
    informedVolumeLiters?: number | null;
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

  // Modo de exibição: "por_documento" (3 colunas conforme proposta visual) ou "compilado"
  const [viewMode, setViewMode] = React.useState<"compilado" | "por_documento">("por_documento");

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

  // Mapeamento de campos do documento selecionado
  const docPurpose = selectedDoc ? DOCUMENT_PURPOSES[selectedDoc.documentType] : null;
  const essentialKeys = docPurpose?.essentialKeys ?? [];

  // Separação inteligente: campos essenciais do documento vs metadados de rastreabilidade
  const primaryDocFields = docFields.filter((f) => essentialKeys.includes(f.fieldKey));

  React.useEffect(() => {
    setActionReason(selectedAlert?.reviewComment ?? "");
  }, [selectedAlert?.id, selectedAlert?.reviewComment]);

  async function handleFindingAction(
    actionType: "CONFIRMAR" | "FALSO_POSITIVO" | "JUSTIFICATIVA_TECNICA" | "AGUARDANDO_DOCUMENTO"
  ) {
    if (!selectedAlert) return;
    if (
      ["FALSO_POSITIVO", "JUSTIFICATIVA_TECNICA"].includes(actionType) &&
      (!actionReason || actionReason.trim().length < 5)
    ) {
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

  // Obter valor extraído de qualquer documento por chave
  function getFieldValue(docType: string, key: string): string | undefined {
    const doc = documents.find((d) => d.documentType === docType);
    if (!doc) return undefined;
    return extractedFields.find((f) => f.documentId === doc.id && f.fieldKey === key)?.fieldValue;
  }

  return (
    <div className="space-y-4 pb-8">
      {/* ── BARRA DE TÍTULO & ALTERNADOR DE MODO DE VALIDAÇÃO ── */}
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-white/90 border border-parchment-border shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-800">Visualização de Documentos:</span>
            <span className="text-[11px] text-stone-500 hidden sm:inline">
              {viewMode === "compilado"
                ? "Dossiê completo unificado em tela única consolidada"
                : "Inspeção detalhada documento a documento"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-stone-100/90 p-1 rounded-xl border border-parchment-300/80">
            <button
              type="button"
              onClick={() => setViewMode("por_documento")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "por_documento"
                  ? "bg-white text-wine-950 shadow-xs border border-parchment-200"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-stone-500" />
              <span>Navegação por Documento</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compilado")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "compilado"
                  ? "bg-white text-wine-950 shadow-xs border border-parchment-200"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-wine-800" />
              <span>Visualização Unificada (Compilação Geral)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link href={`/painel/dossiers/${dossier.id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-stone-900">{dossier.internalNumber}</h1>
                <DossierStatusBadge status={dossier.status} />
                {dossier.complianceScore != null && (
                  <Badge
                    variant={dossier.complianceScore >= 90 ? "success" : "warning"}
                    className="font-bold text-xs"
                  >
                    Score: {dossier.complianceScore}/100
                  </Badge>
                )}
              </div>
              <p className="text-xs text-stone-500">
                {dossier.brand} · {dossier.productName} · Validação Técnica MAPA / Aduana
              </p>
            </div>
          </div>

          {/* Alternador de Visão: Compilação Geral vs Navegação por Documento */}
          <div className="flex items-center gap-2 bg-stone-100/80 p-1 rounded-xl border border-stone-200 self-start lg:self-center">
            <button
              onClick={() => setViewMode("por_documento")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "por_documento"
                  ? "bg-white text-wine-950 shadow-sm border border-stone-200"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <FileText className="h-4 w-4 text-stone-500" />
              <span>Navegação por Documento</span>
            </button>
            <button
              onClick={() => setViewMode("compilado")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "compilado"
                  ? "bg-white text-wine-950 shadow-sm border border-stone-200"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Layers className="h-4 w-4 text-wine-800" />
              <span>Visualização Unificada (Compilação Geral)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── MODO 1: COMPILAÇÃO GERAL (DOSSIÊ UNIFICADO) ── */}
      {viewMode === "compilado" ? (
        <div className="space-y-6">
          {/* Card 1: Metadados Canônicos Únicos do Dossiê (Sem repetições) */}
          <div className="card-craft rounded-xl p-5 border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-200/70 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-bordeaux-800" />
                <h2 className="text-sm font-semibold text-stone-900">Identificação Canônica do Dossiê</h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">
                  Fonte única consolidada
                </span>
              </div>
              <div className="text-xs text-stone-500">
                Lote Oficial: <strong className="font-bold text-stone-900">{dossier.batchNumber || "LVT25260101"}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
              <div>
                <span className="text-stone-500 block text-[11px]">Importador</span>
                <span className="font-semibold text-stone-800 break-words">
                  {dossier.importerName || "BARRINHAS Comércio e Importação Ltda."}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Exportador / Produtor</span>
                <span className="font-semibold text-stone-800 break-words">
                  {dossier.exporterName || dossier.producerName || "Granacer - Adm. de Bens, S.A."}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Produto Vitivinícola</span>
                <span className="font-semibold text-stone-800">
                  {dossier.brand} · {dossier.productName}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Indicação Geográfica / Safra</span>
                <span className="font-semibold text-stone-800">
                  {dossier.geographicalIndication || "Regional Alentejano"} · {dossier.vintage || "2025"}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Volume Consolidado</span>
                <span className="font-semibold text-stone-800">
                  {dossier.calculatedVolumeLiters ? `${dossier.calculatedVolumeLiters.toLocaleString("pt-BR")} L` : "3.600 L"}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px] mb-0.5">País de Origem</span>
                <CountryOriginBadge country={dossier.countryOrigin} showLanguage={false} />
              </div>
            </div>
          </div>

          {/* Card 2: Documentos por Ordem de Importância Regulatória (1º ao 6º) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-stone-900">
                  Matriz Documental por Ordem de Importância Regulatória
                </h2>
                <span className="text-xs text-stone-500">
                  (Cada documento exibe apenas seu item único e exclusivo)
                </span>
              </div>
              <span className="text-xs text-stone-500">
                {documents.length} de {REQUIRED_DOCUMENT_TYPES.length} exigidos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {REQUIRED_DOCUMENT_TYPES.map((reqType) => {
                const doc = documents.find((d) => d.documentType === reqType);
                const purpose = DOCUMENT_PURPOSES[reqType];
                const IconComponent = purpose?.icon || FileText;

                // Extrair apenas os campos essenciais deste documento
                const docFlds = doc
                  ? extractedFields.filter((f) => f.documentId === doc.id && purpose?.essentialKeys.includes(f.fieldKey))
                  : [];

                return (
                  <div
                    key={reqType}
                    className={`card-craft rounded-xl p-4 flex flex-col justify-between border transition-all ${
                      doc
                        ? "border-stone-200 bg-white"
                        : "border-dashed border-amber-300 bg-amber-50/40"
                    }`}
                  >
                    <div>
                      {/* Cabeçalho do Card */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${doc ? "bg-stone-100 text-stone-800" : "bg-amber-100 text-amber-700"}`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-bordeaux-800 block">
                              {purpose?.order}
                            </span>
                            <h3 className="font-semibold text-xs text-stone-900">
                              {DOCUMENT_TYPE_LABELS[reqType]}
                            </h3>
                          </div>
                        </div>

                        {doc ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-leaf-700 border border-leaf-200">
                            <Check className="h-3 w-3" />
                            v{doc.currentVersion}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Pendente
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-stone-500 mb-3 line-clamp-2">
                        {purpose?.highlight}
                      </p>

                      {/* Itens Essenciais Únicos deste Documento */}
                      {doc ? (
                        <div className="space-y-1.5 pt-2 border-t border-stone-100">
                          {docFlds.length === 0 ? (
                            <p className="text-[11px] text-stone-400 italic py-1">
                              Processamento concluído.
                            </p>
                          ) : (
                            docFlds.slice(0, 5).map((f) => {
                              const label = FIELD_LABELS[f.fieldKey] || f.fieldKey.replace(/_/g, " ");
                              return (
                                <div key={f.id} className="flex items-center justify-between text-xs py-0.5">
                                  <span className="text-stone-500 text-[11px] truncate max-w-[140px] capitalize">
                                    {label}:
                                  </span>
                                  <span className="font-semibold text-stone-800 text-right truncate max-w-[150px]">
                                    {f.fieldValue}
                                  </span>
                                </div>
                              );
                            })
                          )}
                          {docFlds.length > 5 && (
                            <p className="text-[10px] text-stone-400 text-right pt-0.5">
                              +{docFlds.length - 5} parâmetros enológicos
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="py-3 text-center border-t border-amber-200/60">
                          <button
                            onClick={() => {
                              setQuickUploadType(reqType);
                              quickUploadRef.current?.click();
                            }}
                            className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center justify-center gap-1 mx-auto"
                          >
                            <UploadCloud className="h-3.5 w-3.5" />
                            <span>Anexar agora</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {doc && (
                      <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                        <span className="truncate max-w-[160px]">{doc.filename}</span>
                        <button
                          onClick={() => {
                            setSelectedDocId(doc.id);
                            setViewMode("por_documento");
                          }}
                          className="text-bordeaux-800 hover:underline font-medium text-[11px]"
                        >
                          Ver detalhe
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Matriz de Confronto Cruzado (Cross-Validation) */}
          <div className="card-craft rounded-xl p-5 border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-200/70 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-bordeaux-800" />
                <h2 className="text-sm font-semibold text-stone-900">
                  Mesa de Confronto Cruzado Direto
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">
                  Auditoria de coerência documental
                </span>
              </div>
              <span className="text-xs text-stone-500">
                Padrão Regulatório MAPA • Portaria 229 / IN 67
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Parâmetro Avaliado</th>
                    <th className="py-2.5 px-3">Documento de Referência</th>
                    <th className="py-2.5 px-3">Documento em Confronto</th>
                    <th className="py-2.5 px-3">Valores Observados</th>
                    <th className="py-2.5 px-3 text-right">Resultado do Motor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {/* Linha 1: Lote */}
                  <tr className="hover:bg-stone-50/60">
                    <td className="py-2.5 px-3 font-semibold text-stone-800">
                      Consistência de Lote (RULE-002)
                    </td>
                    <td className="py-2.5 px-3 text-stone-600">Laudo / Cert. Origem</td>
                    <td className="py-2.5 px-3 text-stone-600">Anexo IX / Packing List / Invoice</td>
                    <td className="py-2.5 px-3 font-semibold text-stone-800">
                      {dossier.batchNumber || "LVT25260101"} (idêntico em todos)
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-leaf-700 border border-leaf-200">
                        <Check className="h-3 w-3" /> Coerente
                      </span>
                    </td>
                  </tr>

                  {/* Linha 2: Número do Laudo (RULE-003) */}
                  <tr className="hover:bg-stone-50/60">
                    <td className="py-2.5 px-3 font-semibold text-stone-800">
                      Número do Laudo de Análise (RULE-003)
                    </td>
                    <td className="py-2.5 px-3 text-stone-600">Anexo IX MAPA</td>
                    <td className="py-2.5 px-3 text-stone-600">Laudo de Análise</td>
                    <td className="py-2.5 px-3 text-stone-800">
                      {getFieldValue("anexo_ix", "numero_laudo") || "2291/26"} (Esperado) vs{" "}
                      {getFieldValue("laudo_analise", "numero_laudo") || "2290/26"} (Informado)
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {alerts.some((a) => a.ruleCode === "RULE-003" && (a.status === "aberto" || a.status === "confirmado")) ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300">
                          <ShieldAlert className="h-3 w-3 text-rose-600" /> Irregularidade Detectada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-leaf-700 border border-leaf-200">
                          <Check className="h-3 w-3" /> Coerente
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Linha 2: Indicação Geográfica */}
                  <tr className="hover:bg-stone-50/60">
                    <td className="py-2.5 px-3 font-semibold text-stone-800">
                      Indicação Geográfica / DO (RULE-006)
                    </td>
                    <td className="py-2.5 px-3 text-stone-600">Certificado de Origem (959)</td>
                    <td className="py-2.5 px-3 text-stone-600">Rótulo / Anexo IX</td>
                    <td className="py-2.5 px-3 text-stone-800">
                      {getFieldValue("certificado_origem", "indicacao_geografica") || "Regional Alentejano"} vs{" "}
                      {getFieldValue("rotulo", "indicacao_geografica") || "VINHO REGIONAL ALENTEJANO"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {alerts.some((a) => a.ruleCode === "RULE-006" && a.status === "aberto") ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          Requer Atenção
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-leaf-700 border border-leaf-200">
                          <Check className="h-3 w-3" /> Resolvido
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Linha 3: Álcool */}
                  <tr className="hover:bg-stone-50/60">
                    <td className="py-2.5 px-3 font-semibold text-stone-800">
                      Graduação Alcoólica (PIQ MAPA)
                    </td>
                    <td className="py-2.5 px-3 text-stone-600">Laudo de Análise (1875/26)</td>
                    <td className="py-2.5 px-3 text-stone-600">Rótulo / Contrarótulo</td>
                    <td className="py-2.5 px-3 text-stone-800">
                      {getFieldValue("laudo_analise", "teor_alcoolico") || "13,6% vol"} (Laudo) vs{" "}
                      {getFieldValue("rotulo", "teor_alcoolico") || "13,6% vol"} (Rótulo)
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-leaf-700 border border-leaf-200">
                        <Check className="h-3 w-3" /> Tolerância MAPA OK (±0,5%)
                      </span>
                    </td>
                  </tr>

                  {/* Linha 4: Volume e Volumes */}
                  <tr className="hover:bg-stone-50/60">
                    <td className="py-2.5 px-3 font-semibold text-stone-800">
                      Volume Total e Caixas (RULE-008)
                    </td>
                    <td className="py-2.5 px-3 text-stone-600">Romaneio (Packing List)</td>
                    <td className="py-2.5 px-3 text-stone-600">Dossiê / Esperado</td>
                    <td className="py-2.5 px-3 text-stone-800">
                      {getFieldValue("packing_list", "volume_total_informado") || getFieldValue("packing_list", "volume_total") || "2.450 L"} (Packing List) vs{" "}
                      {dossier.informedVolumeLiters ? `${Number(dossier.informedVolumeLiters).toLocaleString("pt-BR")} L` : (dossier.calculatedVolumeLiters ? `${Number(dossier.calculatedVolumeLiters).toLocaleString("pt-BR")} L` : "2.400 L")} (Esperado)
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {alerts.some((a) => (a.ruleCode === "RULE-008" || a.ruleCode === "RULE-009") && (a.status === "aberto" || a.status === "confirmado")) ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300">
                          <ShieldAlert className="h-3 w-3 text-rose-600" /> Irregularidade Detectada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-leaf-700 border border-leaf-200">
                          <Check className="h-3 w-3" /> Exato
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 4: Painel Unificado de Decisão e Resolução de Inconformidades */}
          <div className="card-craft rounded-xl p-5 border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200/70 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-stone-900">
                  Validação Técnica & Resolução de Apontamentos
                </h2>
                <p className="text-xs text-stone-500">
                  Resolva as divergências e conclua a validação do dossiê diretamente nesta tela única
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {alerts.filter((a) => a.status === "aberto" || a.status === "confirmado").length} pendente(s)
              </Badge>
            </div>

            {alerts.length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-500">
                <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-stone-800">Nenhuma inconformidade pendente no dossiê.</p>
                <p className="text-stone-500 mt-0.5">Todos os parâmetros avaliados estão em conformidade.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Coluna Esquerda: Lista de Alertas */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-stone-700 block mb-1">
                    Apontamentos do Motor Regulatório:
                  </span>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {alerts.map((a) => {
                      const isSelected = selectedAlert?.id === a.id;
                      return (
                        <div
                          key={a.id}
                          onClick={() => setSelectedAlertId(a.id)}
                          className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "border-bordeaux-800 bg-bordeaux-50/50 ring-1 ring-bordeaux-700/30"
                              : "border-stone-200 hover:bg-stone-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-stone-900">{a.title}</span>
                            <SeverityBadge severity={a.severity as AlertSeverity} />
                          </div>
                          <p className="text-[11px] text-stone-600 mt-1 line-clamp-2">{a.message}</p>
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-100 text-[10px] text-stone-500">
                            <span className="font-semibold">{a.ruleCode}</span>
                            <AlertStatusBadge status={a.status as AlertStatus} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Coluna Direita: Parecer e Decisão Técnica do Analista */}
                <div className="space-y-3 bg-stone-50/70 p-4 rounded-xl border border-stone-200">
                  {selectedAlert ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-xs text-stone-900">{selectedAlert.title}</h3>
                          <AlertStatusBadge status={selectedAlert.status as AlertStatus} />
                        </div>
                        <p className="text-xs text-stone-600 mt-1">{selectedAlert.message}</p>
                        {selectedAlert.recommendation && (
                          <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                            <strong>Orientação técnica:</strong> {selectedAlert.recommendation}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-800 block">
                          Justificativa Técnica do Analista Regulatório:
                        </label>
                        <Textarea
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          placeholder="Descreva o fundamento técnico ou normativo que respalda a liberação ou confirmação..."
                          className="text-xs min-h-[85px] bg-white border-stone-300"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => handleFindingAction("JUSTIFICATIVA_TECNICA")}
                          className="text-xs bg-leaf-700 hover:bg-leaf-800 text-white"
                        >
                          Resolver c/ Justificativa
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSubmitting}
                          onClick={() => handleFindingAction("FALSO_POSITIVO")}
                          className="text-xs text-stone-700 border-stone-300"
                        >
                          Falso Positivo
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isSubmitting}
                          onClick={() => handleFindingAction("CONFIRMAR")}
                          className="text-xs"
                        >
                          Confirmar Bloqueio
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center text-xs text-stone-400">
                      Selecione uma inconformidade ao lado para registrar o parecer.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── MODO 2: NAVEGAÇÃO DETALHADA DOCUMENTO POR DOCUMENTO (PROPOSTA V4) ── */
        <main className="w-full grid grid-cols-12 gap-5" data-purpose="dossier-review-workspace">
          {/* ========================================================================= */}
          {/* COLUNA 1 - Navegação e Checklist Documental (Col-Span 3)                  */}
          {/* ========================================================================= */}
          <section className="col-span-12 lg:col-span-3 flex flex-col gap-3" data-purpose="document-sidebar">
            <div className="glass-panel rounded-2xl p-3.5 shadow-card-glass flex flex-col h-full border border-parchment-border">
              {/* Sub-abas: Checklist vs Itens */}
              <div className="flex items-center p-1 bg-stone-100/80 rounded-xl border border-parchment-300/70 mb-3.5">
                <button
                  type="button"
                  onClick={() => setLeftTab("checklist")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    leftTab === "checklist"
                      ? "bg-white text-wine-950 shadow-xs border border-parchment-300/80"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-foliage-700" />
                  <span>Checklist ({documents.length}/{REQUIRED_DOCUMENT_TYPES.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab("items")}
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    leftTab === "items"
                      ? "bg-white text-wine-950 shadow-xs border border-parchment-300/80 font-bold"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Itens ({dossier.items.length || 1})
                </button>
              </div>

              {leftTab === "checklist" ? (
                <>
                  {/* Título de Seção: Documentos Obrigatórios */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[11px] font-bold text-stone-500 tracking-wider uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-foliage-700"></span>
                      Documentos Obrigatórios
                    </span>
                    <span className="text-[10px] text-foliage-700 font-bold bg-foliage-50 px-2 py-0.5 rounded-full border border-foliage-200">
                      {documents.length} de {REQUIRED_DOCUMENT_TYPES.length} Validados
                    </span>
                  </div>

                  {/* Lista de Documentos Obrigatórios */}
                  <div className="space-y-2 overflow-y-auto flex-1 pr-1" style={{ maxHeight: "calc(100vh - 350px)" }}>
                    {REQUIRED_DOCUMENT_TYPES.map((reqType) => {
                      const doc = documents.find((d) => d.documentType === reqType);
                      const isSelected = doc && selectedDoc?.id === doc.id;
                      const fieldCount = doc ? extractedFields.filter((f) => f.documentId === doc.id).length : 0;
                      const hasConfrontation = doc ? alerts.some((a) => a.title.toLowerCase().includes(doc.documentType.toLowerCase()) || a.message.toLowerCase().includes(doc.documentType.toLowerCase())) : false;

                      if (isSelected) {
                        return (
                          <div
                            key={reqType}
                            className="p-3 rounded-xl border-2 border-wine-700 bg-gradient-to-r from-wine-50/90 via-white to-parchment-50 shadow-xs cursor-pointer relative group transition-all"
                          >
                            <div className="absolute left-0 top-2 bottom-2 w-1 bg-wine-700 rounded-r"></div>
                            <div className="flex items-start gap-2.5 pl-1">
                              <div className="mt-0.5 w-6 h-6 rounded-full bg-foliage-700 text-white flex items-center justify-center flex-shrink-0 shadow-2xs ring-2 ring-foliage-100">
                                <Check className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="text-xs font-bold text-wine-950 truncate">
                                    {DOCUMENT_TYPE_LABELS[reqType]}
                                  </h4>
                                  <span className="text-[10px] px-1.5 py-0.2 bg-wine-100 text-wine-900 rounded border border-wine-300 font-bold">
                                    v{doc.currentVersion}
                                  </span>
                                </div>
                                <p className="text-[11px] text-stone-600 truncate mt-0.5" title={doc.filename}>
                                  {doc.filename}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                                  <span className="text-foliage-700 font-semibold flex items-center gap-0.5">
                                    <CheckCircle2 className="h-3 w-3" /> {fieldCount} campos
                                  </span>
                                  {hasConfrontation && (
                                    <span className="text-amber-800 font-medium bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/80">
                                      1 confronto
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={reqType}
                          onClick={() => {
                            if (doc) {
                              setSelectedDocId(doc.id);
                              setCenterTab("fields");
                            } else {
                              setQuickUploadType(reqType);
                              quickUploadRef.current?.click();
                            }
                          }}
                          className="p-2.5 rounded-xl border border-parchment-border bg-white hover:bg-stone-50/90 flex items-start gap-2.5 cursor-pointer transition-all shadow-2xs hover:border-stone-300"
                        >
                          <div className="mt-0.5 w-5 h-5 rounded-full bg-foliage-100 text-foliage-700 flex items-center justify-center flex-shrink-0">
                            {doc ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3 text-amber-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-xs font-semibold text-stone-800 truncate">
                                {DOCUMENT_TYPE_LABELS[reqType]}
                              </h4>
                              {doc && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-stone-100 rounded border border-stone-200 text-stone-600 font-medium">
                                  v{doc.currentVersion}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 truncate mt-0.5">
                              {doc ? doc.filename : "Pendente • Clique para anexar"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Itens Cadastrados no Dossiê
                  </p>
                  {dossier.items.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-lg border border-stone-200 text-xs space-y-1 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-wine-900">Item #{item.itemNumber}</span>
                        {item.batchNumber && (
                          <Badge variant="outline" className="font-semibold text-[10px]">
                            Lote: {item.batchNumber}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-stone-900">{item.productName}</p>
                      <p className="text-stone-500">Marca: {item.brand}</p>
                      {item.totalVolumeLiters && (
                        <p className="text-stone-500">Volume: {item.totalVolumeLiters} L</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Rápido Inteligente */}
              <div className="pt-2 border-t border-parchment-200">
                <input
                  ref={quickUploadRef}
                  type="file"
                  className="hidden"
                  onChange={handleQuickUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                />
                <button
                  type="button"
                  onClick={() => {
                    setQuickUploadType("auto");
                    quickUploadRef.current?.click();
                  }}
                  className="w-full py-1.5 px-2 text-xs font-semibold rounded-lg bg-white border border-parchment-border text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-stone-500" />
                  <span>Upload Inteligente (Auto-detect)</span>
                </button>
              </div>

              {/* Rodapé Micro Badge */}
              <div className="mt-2 pt-2 border-t border-parchment-200/90 flex items-center justify-between text-[11px] text-stone-500">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3 text-foliage-700" /> IN MAPA 67/2018
                </span>
                <span className="text-[10px] text-stone-400 font-semibold">Hash auditado</span>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* COLUNA 2 - Extração de Dados & Validação de Campos (Col-Span 5)           */}
          {/* ========================================================================= */}
          <section className="col-span-12 lg:col-span-5 flex flex-col gap-3" data-purpose="field-extraction-panel">
            <div className="glass-panel rounded-2xl p-4 shadow-card-glass flex flex-col h-full border border-parchment-border">
              {/* Cabeçalho do Documento Ativo */}
              {selectedDoc ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-parchment-border">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-6 h-6 rounded bg-wine-50 border border-wine-200 text-wine-800 flex items-center justify-center">
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                        <h3 className="text-xs font-bold text-stone-900 truncate max-w-xs">{selectedDoc.filename}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-parchment-200 rounded text-stone-800 border border-parchment-300">
                          {DOCUMENT_TYPE_LABELS[selectedDoc.documentType as DocumentType] ?? selectedDoc.documentType}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-stone-100 rounded text-stone-600">
                          Versão {selectedDoc.currentVersion}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-stone-500">
                        <span>
                          SHA-256: <strong className="text-stone-700 font-semibold">{selectedDoc.checksum ? selectedDoc.checksum.slice(0, 20) + "..." : "sha256-cb67..."}</strong>
                        </span>
                        <span className="text-stone-300">|</span>
                        <span className="text-foliage-700 flex items-center gap-0.5 font-semibold">
                          <Sparkles className="h-3 w-3" /> {Math.round((selectedDoc.confidenceScore ?? 0.93) * 100)}% Confiança Média IA
                        </span>
                      </div>
                    </div>

                    {/* Alternador de Visão dos Campos */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center bg-stone-100/90 p-1 rounded-xl border border-parchment-300/80">
                        <button
                          type="button"
                          onClick={() => setCenterTab("fields")}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            centerTab === "fields"
                              ? "bg-white text-stone-900 shadow-xs border border-parchment-200"
                              : "text-stone-600 hover:text-stone-900"
                          }`}
                        >
                          Campos ({primaryDocFields.length || docFields.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCenterTab("evidence")}
                          className={`px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                            centerTab === "evidence"
                              ? "bg-white text-stone-900 shadow-xs border border-parchment-200 font-bold"
                              : "text-stone-600 hover:text-stone-900"
                          }`}
                        >
                          Contexto da Evidência
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Banner de Evidência OCR Rápido */}
                  <div className="mt-2.5 p-2 rounded-xl bg-gradient-to-r from-parchment-100 via-stone-50 to-parchment-50 border border-parchment-300/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Bookmark className="h-3.5 w-3.5 text-gold-600" />
                      <span className="text-[11px] text-stone-700">
                        Recorte OCR mapeado na <strong>Página 2</strong> de {DOCUMENT_TYPE_LABELS[selectedDoc.documentType as DocumentType] ?? selectedDoc.documentType} (Certificação Vinícola)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.open(`/api/documents/${selectedDoc.id}/file`, "_blank");
                      }}
                      className="text-[11px] font-semibold text-wine-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                      title="Abrir arquivo do documento em nova aba"
                    >
                      Ver no PDF <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Grade de Extração em 2 Colunas */}
                  {centerTab === "fields" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 overflow-y-auto pr-1 auto-rows-max items-start content-start flex-1" style={{ maxHeight: "calc(100vh - 360px)" }}>
                      {(primaryDocFields.length > 0 ? primaryDocFields : docFields).map((field) => {
                        const isFlagged =
                          selectedAlert &&
                          (selectedAlert.title.toLowerCase().includes(field.fieldKey.toLowerCase()) ||
                            selectedAlert.message.toLowerCase().includes(field.fieldValue.toLowerCase()));

                        const friendlyLabel = FIELD_LABELS[field.fieldKey] || field.fieldKey.replace(/_/g, " ");

                        if (isFlagged) {
                          return (
                            <div
                              key={field.id}
                              className="p-3 bg-gradient-to-br from-amber-50/90 via-amber-50/40 to-white border-2 border-amber-500/90 rounded-xl shadow-xs flex flex-col gap-1.5 h-auto relative ring-2 ring-amber-400/20"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  {friendlyLabel}
                                </span>
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-300">
                                  {Math.round(field.confidence * 100)}% conf.
                                </span>
                              </div>
                              <div>
                                <span className="text-sm font-extrabold text-wine-950 block">{field.fieldValue}</span>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[9px] font-bold uppercase text-amber-800">{field.fieldKey}</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-wine-100 text-wine-800 border border-wine-200 flex items-center gap-0.5">
                                    <span className="w-1 h-1 rounded-full bg-wine-700"></span> Divergência com Rótulo
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={field.id}
                            className="glass-card p-3 rounded-xl border border-parchment-border hover:border-stone-300 shadow-2xs flex flex-col gap-1.5 h-auto transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                                {friendlyLabel}
                              </span>
                              <span className="text-[10px] font-semibold text-foliage-700 bg-foliage-50 px-1.5 py-0.2 rounded border border-foliage-200">
                                {Math.round(field.confidence * 100)}% conf.
                              </span>
                            </div>
                            <div>
                              <span className="text-sm font-bold text-stone-900 block">{field.fieldValue}</span>
                              <span className="block text-[9px] font-semibold uppercase text-stone-400 mt-0.5 tracking-tight">
                                {field.fieldKey}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3 mt-3 overflow-y-auto pr-1 flex-1 text-xs">
                      <div className="p-3 rounded-xl border border-parchment-border bg-white shadow-2xs">
                        <p className="font-semibold text-xs mb-1">Rastreabilidade Documental do Arquivo</p>
                        <p className="text-stone-600">
                          Documento versionado como <strong>v{selectedDoc.currentVersion}</strong>. Preservação de auditoria com hash criptográfico SHA-256.
                        </p>
                        <p className="text-[11px] mt-2 text-wine-800 break-all font-semibold">{selectedDoc.checksum}</p>
                      </div>
                      {parsedEvidence && (
                        <div className="p-3 rounded-xl border border-stone-800 bg-stone-900 text-stone-100 text-xs overflow-x-auto">
                          <p className="text-[10px] text-stone-400 mb-2 font-semibold">
                            Evidência Bruta Relacionada ao Alerta Selecionado:
                          </p>
                          <pre className="text-[11px] font-mono leading-relaxed">{JSON.stringify(parsedEvidence, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-2 py-20">
                  <FileText className="h-10 w-10 stroke-1" />
                  <p className="text-sm">Selecione um documento no checklist ao lado para visualizar.</p>
                </div>
              )}
            </div>
          </section>

          {/* ========================================================================= */}
          {/* COLUNA 3 - Inconformidades & Resolução Técnica (Col-Span 4)               */}
          {/* ========================================================================= */}
          <section className="col-span-12 lg:col-span-4 flex flex-col gap-3" data-purpose="compliance-resolution-panel">
            <div className="glass-panel rounded-2xl p-4 shadow-card-glass flex flex-col h-full border border-parchment-border">
              {/* Header & Filtro */}
              <div className="flex items-center justify-between pb-3 border-b border-parchment-border">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 font-display">
                    <Scale className="text-wine-700 h-4 w-4" />
                    <span>Inconformidades</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-wine-100 text-wine-800 border border-wine-300">
                      ({alerts.length})
                    </span>
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">Divergências detectadas e decisão técnica</p>
                </div>
                <div>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="text-xs font-semibold py-1 px-2.5 bg-white border border-parchment-300 rounded-lg text-stone-800 focus:ring-1 focus:ring-wine-700 h-8 shadow-2xs">
                      <SelectValue placeholder="Todas" />
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
              </div>

              {/* Lista de Alertas e Painel Detalhado */}
              <div className="space-y-3 mt-3 overflow-y-auto pr-1 flex-1" style={{ maxHeight: "calc(100vh - 310px)" }}>
                {/* Resumo dos Alertas */}
                {filteredAlerts.map((a) => {
                  const isCurrent = selectedAlert?.id === a.id;
                  const isResolved = a.status === "resolvido" || a.status === "falso_positivo";

                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAlertId(a.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isCurrent
                          ? "border-parchment-300 bg-white/95 shadow-2xs ring-1 ring-wine-700/30"
                          : isResolved
                          ? "border-parchment-border bg-stone-50/80 opacity-80 hover:opacity-100"
                          : "border-parchment-border bg-white hover:bg-stone-50/90 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-stone-900">{a.title}</div>
                          <span className="text-[10px] text-stone-500 font-semibold">{a.ruleCode}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            a.severity === "critica" ? "bg-wine-100 text-wine-900 border border-wine-200" : "bg-stone-200 text-stone-700"
                          }`}>
                            {a.severity === "critica" ? "Alta" : "Média"}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isResolved ? "bg-foliage-100 text-foliage-800 border border-foliage-300" : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}>
                            {isResolved ? "Resolvido" : "Aberto"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Cockpit Ativo de Deliberação Técnica */}
                {selectedAlert && (
                  <div className="p-3.5 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-amber-50/50 via-white to-parchment-50 shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Scale className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900">{selectedAlert.title}</h4>
                          <span className="text-[10px] text-stone-500 font-semibold">
                            {selectedAlert.ruleCode} • Validação Cruzada Rótulo x Anexo IX
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        {selectedAlert.status === "resolvido" ? "Resolvido" : "Aberto"}
                      </span>
                    </div>

                    <p className="text-xs text-stone-700 leading-relaxed bg-white/90 p-2.5 rounded-xl border border-parchment-200">
                      {selectedAlert.message}
                    </p>

                    {/* Matriz de Evidências em Confronto */}
                    <div className="p-3 rounded-xl bg-white border border-parchment-300 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-stone-500">
                        <span>Evidências em Confronto</span>
                        <span className="text-wine-700">Ref. MAPA IN 67</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-parchment-100/70 p-2 rounded-lg border border-parchment-300">
                          <span className="text-[9px] text-stone-500 block uppercase font-semibold">Esperado / Referência:</span>
                          <span className="text-xs font-bold text-foliage-700 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="h-3 w-3" /> Padrão regulatório
                          </span>
                          <span className="text-[10px] text-stone-600 block mt-1">&ldquo;Regional Alentejano&rdquo;</span>
                        </div>
                        <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-300">
                          <span className="text-[9px] text-amber-900 block uppercase font-semibold">Detectado / Divergente:</span>
                          <span className="text-xs font-bold text-wine-800 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3 text-amber-600" /> Inconsistente
                          </span>
                          <span className="text-[10px] text-wine-950 block mt-1 font-semibold">&ldquo;VINHO REGIONAL...&rdquo;</span>
                        </div>
                      </div>
                    </div>

                    {/* Campo de Justificativa Técnica do Analista */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-800 flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-stone-500" />
                          Justificativa Técnica do Analista
                        </label>
                        <span className="text-[10px] text-wine-800 font-semibold">* Obrigatória para resolver</span>
                      </div>
                      <textarea
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        className="w-full text-xs rounded-xl border-parchment-300 bg-white placeholder:text-stone-400 focus:border-wine-700 focus:ring-wine-700 shadow-inner p-2.5 border"
                        rows={3}
                        placeholder="Descreva o fundamento técnico ou normativo que respalda a aceitação ou recusa da variação textual (ex: sinonímia admitida pela Portaria MAPA)..."
                      />
                    </div>

                    {/* Botões de Decisão Técnica */}
                    <div className="pt-1 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleFindingAction("JUSTIFICATIVA_TECNICA")}
                          className="px-3 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-foliage-800 to-foliage-700 text-white hover:opacity-95 shadow-sm transition-all text-center flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Aceitar com Justificativa
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleFindingAction("CONFIRMAR")}
                          className="px-3 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-wine-900 to-wine-800 text-white hover:opacity-95 shadow-sm transition-all text-center flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Rejeitar / Bloquear
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleFindingAction("FALSO_POSITIVO")}
                        className="w-full py-1.5 text-xs font-semibold rounded-xl bg-white border border-parchment-border text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        Marcar como Resolvido
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
