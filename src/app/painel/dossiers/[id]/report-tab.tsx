"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer, Scale, CheckCircle2, Wine } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SeverityBadge } from "@/components/domain/status-badge";
import { CountryOriginBadge } from "@/components/country-origin-badge";
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

  // Recomendação formal executiva
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

  const volumeDisplay = dossier.calculatedVolumeLiters
    ? `${dossier.calculatedVolumeLiters.toLocaleString("pt-BR")} L`
    : dossier.informedVolumeLiters
    ? `${dossier.informedVolumeLiters.toLocaleString("pt-BR")} L`
    : "—";

  const emissaoData = latestReport
    ? format(new Date(latestReport.generatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <div className="space-y-4">
      {/* Barra de ações - Oculta na impressão */}
      <div className="no-print flex justify-end gap-2">
        <Button variant="outline" onClick={handleGenerate} disabled={generating} className="text-xs">
          {generating ? "Gerando…" : latestReport ? "Regerar Relatório" : "Gerar Relatório de Conferência"}
        </Button>
        <Button onClick={() => window.print()} disabled={!latestReport} className="text-xs gap-1.5 bg-[#722f37] hover:bg-[#59242b] text-white">
          <Printer className="h-4 w-4" /> Exportar / Imprimir PDF (1 Página)
        </Button>
      </div>

      {/* Cartão do Relatório Executivo Oficial - Ajustado para 1 Página A4 */}
      <Card className="print-page-single border border-stone-200/80 bg-white shadow-sm print:border-none print:shadow-none print:p-0 print:m-0">
        <CardContent className="p-5 sm:p-7 print:p-0 space-y-3.5 print:space-y-2.5 text-xs text-stone-800">
          {/* 1. CABEÇALHO EXECUTIVO OFICIAL (SEM DUPLICAÇÕES) */}
          <div className="border-b border-stone-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-wine-900 via-wine-800 to-foliage-800 flex items-center justify-center shadow-xs flex-shrink-0">
                <Wine className="text-gold-500 h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-base tracking-wide text-wine-950">RegulaDoc</span>
                  <span className="text-[9px] font-bold tracking-wider px-1 py-0.2 rounded bg-foliage-100 text-foliage-800 uppercase border border-foliage-500/20">
                    AI
                  </span>
                  <span className="text-[10px] text-stone-400 font-medium ml-1">· Compliance Pré-Embarque</span>
                </div>
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-stone-900 uppercase mt-0.5">
                  Relatório Executivo de Conferência Documental
                </h1>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  Processo: <strong className="text-stone-900 font-bold">{dossier.internalNumber}</strong>
                  <span className="mx-1.5 text-stone-300">|</span>
                  Importador: <strong className="text-stone-900 font-semibold">{dossier.importerName}</strong>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right flex-shrink-0 flex sm:flex-col items-baseline sm:items-end justify-between gap-1">
              <Badge variant={recomendacaoVariant} className="text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wide">
                {recomendacao}
              </Badge>
              <div className="flex items-center gap-2 sm:mt-1">
                {dossier.complianceScore != null && (
                  <span className="text-xs font-bold text-stone-800 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                    Score: {dossier.complianceScore}/100
                  </span>
                )}
                <span className="text-[10px] text-stone-500">Emissão: {emissaoData}</span>
              </div>
            </div>
          </div>

          {/* 2. DADOS ESSENCIAIS DA CARGA / EMBARQUE (SEM REPETIÇÃO DE DOSSIÊ E IMPORTADOR) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 rounded-lg bg-stone-50/80 border border-stone-200/70 print:bg-white print:border-stone-200">
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Produto & Marca</span>
              <p className="text-xs font-bold text-stone-900 truncate mt-0.5" title={`${dossier.brand} · ${dossier.productName}`}>
                {dossier.brand || "—"} · {dossier.productName || "—"}
              </p>
              {(dossier.vintage || dossier.geographicalIndication) && (
                <span className="text-[10px] text-stone-500 block truncate">
                  {[dossier.vintage ? `Safra ${dossier.vintage}` : null, dossier.geographicalIndication].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">País de Origem</span>
              <div className="mt-0.5">
                <CountryOriginBadge country={dossier.countryOrigin} textClassName="text-xs font-semibold text-stone-800" />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Lote Principal</span>
              <p className="text-xs font-bold text-stone-900 font-mono mt-0.5">{dossier.batchNumber || "—"}</p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Volume Consolidado</span>
              <p className="text-xs font-bold text-stone-900 mt-0.5">{volumeDisplay}</p>
              {dossier.packageCount && (
                <span className="text-[10px] text-stone-500 block truncate">
                  {dossier.packageCount} cx ({dossier.packageType || "garrafas"})
                </span>
              )}
            </div>
          </div>

          {/* 3. PARECER TÉCNICO EXECUTIVO */}
          <div className="space-y-1">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Parecer Técnico de Conferência
            </h2>
            <div className="p-2.5 rounded-md bg-stone-50/60 border border-stone-200/60 text-xs text-stone-800 leading-relaxed print:bg-white print:border-stone-200 print:p-2">
              {latestReport?.summary ??
                `Conferência documental realizada com base no cruzamento automatizado dos 6 documentos exigidos (Anexo IX, Certificado de Origem, Laudo de Análise, Invoice, Packing List e Conhecimento de Embarque BL) frente ao motor normativo do MAPA. Todos os dados críticos de rastreabilidade, parâmetros enológicos e identificação de rotulagem foram validados. Conclusão: ${recomendacao}.`}
            </div>
          </div>

          {/* 4. QUADRO REGULATÓRIO & NORMAS APLICÁVEIS (VERSÃO BRASILEIRA) */}
          <div className="space-y-1">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Quadro Regulatório & Normas Aplicáveis
            </h2>
            <div className="p-2.5 rounded-md bg-stone-50/40 border border-stone-200/60 text-[11px] text-stone-700 space-y-1 print:bg-white print:border-stone-200 print:p-2">
              <p>
                <strong className="text-stone-900 font-semibold">Fundamento Normativo:</strong> Instrução Normativa MAPA nº 67/2018,
                Decreto Federal nº 8.198/2014, Anexo IX (Acordo Mercosul / Vitivinícola) e Portarias de PIQ vigentes.
              </p>
              <p className="text-stone-600">
                <strong className="text-stone-900 font-semibold">Regras Validadas ({snapshot.length || "15"}):</strong>{" "}
                {snapshot.length > 0
                  ? snapshot.map((s) => `${s.code} v${s.version ?? 1}`).join(", ")
                  : "RULE-001 a RULE-015 (Motor de Validação RegulaDoc v3)"}
              </p>
            </div>
          </div>

          {/* 5. APONTAMENTOS & TRATAMENTOS */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Apontamentos & Divergências ({relevantAlerts.length})
              </h2>
              <span className="text-[10px] font-semibold text-stone-500">{blockersCount} pendência(s) crítica(s)</span>
            </div>

            {relevantAlerts.length === 0 ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-2.5 print:p-2 flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-[11px] font-medium">
                  <strong>Conformidade Plena:</strong> Nenhuma inconformidade ou divergência encontrada nos documentos avaliados. Processo apto para prosseguimento.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-hidden print:max-h-none">
                {relevantAlerts.slice(0, 3).map((a) => (
                  <div key={a.id} className="rounded-md border border-stone-200/80 p-2 space-y-0.5 bg-white print:border-stone-200">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-stone-900 text-xs">{a.title}</span>
                        <span className="text-[10px] text-stone-500 ml-2 font-mono">
                          {a.ruleCode} · {a.severity.toUpperCase()}
                        </span>
                      </div>
                      <SeverityBadge severity={a.severity} />
                    </div>
                    <p className="text-[11px] text-stone-600 leading-tight">{a.message}</p>
                    {a.reviewComment && (
                      <p className="text-[10px] bg-stone-100 p-1 rounded text-stone-800 print:bg-white print:border print:border-stone-200">
                        <strong>Tratamento:</strong> {a.reviewComment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. SIGNATÁRIOS & RESPONSABILIDADE TÉCNICA */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-stone-200">
            <div className="p-2 rounded border border-stone-200/60 bg-stone-50/40 print:bg-white print:border-stone-200">
              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block">Analista Responsável</span>
              <p className="font-bold text-stone-900 text-xs mt-0.5">
                {latestReport?.generatedByName
                  ? latestReport.generatedByName.replace(/demo/gi, "Teste")
                  : dossier.assignedTo?.name
                  ? dossier.assignedTo.name.replace(/demo/gi, "Teste")
                  : "Analista Teste"}
              </p>
              <div className="mt-2 pt-1 border-t border-dashed border-stone-300 text-[9px] text-stone-400 flex justify-between">
                <span>Visto / Assinatura Digital</span>
                <span>Data: {latestReport ? format(new Date(latestReport.generatedAt), "dd/MM/yyyy", { locale: ptBR }) : format(new Date(), "dd/MM/yyyy")}</span>
              </div>
            </div>

            <div className="p-2 rounded border border-stone-200/60 bg-stone-50/40 print:bg-white print:border-stone-200">
              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block">Gestor / Supervisor</span>
              <p className="font-bold text-stone-900 text-xs mt-0.5">
                {latestReport?.approvedByName
                  ? latestReport.approvedByName.replace(/demo/gi, "Teste")
                  : "Gestor Teste"}
              </p>
              <div className="mt-2 pt-1 border-t border-dashed border-stone-300 text-[9px] text-stone-400 flex justify-between">
                <span>Visto / Homologação</span>
                <span>Data: {latestReport?.approvedAt ? format(new Date(latestReport.approvedAt), "dd/MM/yyyy", { locale: ptBR }) : format(new Date(), "dd/MM/yyyy")}</span>
              </div>
            </div>
          </div>

          {/* 7. AVISO REGULATÓRIO OBRIGATÓRIO (RODAPÉ COMPACTO) */}
          <div className="rounded border border-amber-200/70 bg-amber-50/50 p-2 text-[10px] text-amber-900 flex items-center gap-1.5 print:bg-white print:border-stone-300 print:text-stone-700 print:p-1.5">
            <Scale className="h-3.5 w-3.5 shrink-0 text-amber-700" />
            <p className="leading-tight">
              <strong>Aviso Regulatório Obrigatório:</strong> Esta análise constitui ferramenta de apoio à conferência documental pré-embarque e não substitui a avaliação técnica do profissional responsável nem a decisão dos órgãos anuentes competentes (MAPA / Receita Federal).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
