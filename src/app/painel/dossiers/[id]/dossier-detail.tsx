"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, LayoutGrid, ShieldAlert, Sparkles, Wine } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditTab } from "./audit-tab";
import { DocumentsTab } from "./documents-tab";
import { HeaderActions } from "./header-actions";
import { OverviewTab } from "./overview-tab";
import { ReportTab } from "./report-tab";
import { ReviewClient } from "./review/review-client";
import { AssistantDrawer } from "./assistant-drawer";
import type { DossierDetailProps } from "./types";

export function DossierDetail({
  tenant,
  dossier,
  documents,
  extractedFields,
  validationRuns,
  alerts,
  auditEvents,
  reports,
  missingRequiredDocuments,
  isExtractionSimulated,
}: DossierDetailProps) {
  const [activeTab, setActiveTab] = React.useState("overview");

  const criticalAlertsCount = alerts.filter(
    (a) => a.severity === "critica" && (a.status === "aberto" || a.status === "confirmado")
  ).length;

  const score = dossier.complianceScore ?? 85;

  return (
    <div className="space-y-5">
      {/* ── HEADER PRINCIPAL: IDENTIDADE VISUAL & CONTEXTO DO DOSSIÊ ── */}
      <header className="glass-panel sticky top-0 z-40 border-b border-parchment-border/90 shadow-sm rounded-2xl p-4 sm:p-5">
        <div className="max-w-[1720px] mx-auto space-y-3">
          {/* Top Section: Info & Ações na Esquerda + Compliance Score Imponente na Direita */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pb-3 border-b border-parchment-300/60">
            {/* Esquerda: Identificação, Badges e Ações Operacionais */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Linha 1: Marca, Identificação do Dossiê e Status */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Insígnia da Marca */}
                <div className="flex items-center gap-2.5 pr-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-wine-900 via-wine-800 to-foliage-800 flex items-center justify-center shadow-md ring-1 ring-gold-500/30">
                    <Wine className="text-gold-500 h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-serif font-bold text-lg tracking-wide text-wine-950">RegulaDoc</span>
                    <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-foliage-100 text-foliage-800 uppercase border border-foliage-500/20">
                      AI
                    </span>
                  </div>
                </div>

                <div className="h-6 w-px bg-parchment-300/80 hidden sm:block"></div>

                {/* Link Voltar & Número do Dossiê */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Link
                    href="/painel/dossiers"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-foliage-700 hover:text-foliage-900 transition-colors group"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    Dossiês
                  </Link>
                  <span className="text-stone-300">/</span>
                  <span className="font-serif text-2xl font-bold tracking-tight text-wine-950">
                    {dossier.internalNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300/70 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    {dossier.status === "READY_FOR_REVIEW" || dossier.status === "em_revisao"
                      ? "Em Revisão Técnica"
                      : dossier.status === "APPROVED" || dossier.status === "aprovado"
                      ? "Aprovado MAPA"
                      : dossier.status === "BLOCKED"
                      ? "Bloqueado"
                      : "Em Análise"}
                  </span>
                  {criticalAlertsCount === 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300/70">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Sem bloqueios críticos
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-300/70">
                      <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                      {criticalAlertsCount} blocker(s)
                    </span>
                  )}
                </div>
              </div>

              {/* Linha 2: Botões de Ação Executiva */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <AssistantDrawer
                  dossierId={dossier.id}
                  triggerButton={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-foliage-800 via-foliage-700 to-emerald-700 text-white shadow-sm hover:shadow-emerald-glow transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-gold-500" />
                      <span>Assistente Contextual AI</span>
                    </button>
                  }
                />
                <HeaderActions
                  dossierId={dossier.id}
                  internalNumber={dossier.internalNumber}
                  role={tenant.role}
                  status={dossier.status}
                  complianceScore={dossier.complianceScore}
                  hasDocuments={documents.length > 0}
                  hasValidated={validationRuns.length > 0}
                  hasReport={reports.length > 0}
                />
              </div>
            </div>

            {/* Direita: Compliance Score Imponente (Modelo Proposto) */}
            <div className="bg-white rounded-2xl px-5 py-3.5 border border-stone-200/90 shadow-sm flex flex-col items-center justify-center flex-shrink-0 self-center lg:self-stretch min-w-[190px]">
              <h4 className="text-xs font-bold tracking-tight text-wine-950 mb-1 font-display">
                Compliance Score
              </h4>
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 120 120">
                  {/* Círculo de trilha fina */}
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="1.5"
                  />
                  {/* Arco de base escura / deduções */}
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#0c2340"
                    strokeWidth="9"
                    strokeDasharray="289.02"
                    strokeDashoffset={289.02 - (289.02 * Math.min(30, Math.max(15, 100 - score))) / 100}
                    strokeLinecap="round"
                  />
                  {/* Arco de score verde */}
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#5ea32a"
                    strokeWidth="9"
                    strokeDasharray="289.02"
                    strokeDashoffset={289.02 - (289.02 * score) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                {/* Conteúdo Central */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <span className="text-[11px] font-semibold text-stone-500 font-sans tracking-tight">
                    ({100} - {Math.max(0, 100 - score)})
                  </span>
                  <span className="text-3xl font-extrabold text-wine-950 font-sans tracking-tight leading-none mt-0.5">
                    {score}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Linha 2: Faixa de Contexto do Produto Regulado (Card Unificado) */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-3.5 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Bloco 1: Produto Regulado & Selo Enológico */}
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#faecee] border border-[#f5d0d6] flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Wine className="text-[#802a36] h-6 w-6 stroke-[1.75]" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#fae8e8] text-[#9b2c3b] uppercase tracking-wider">
                    PRODUTO REGULADO
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                    {dossier.geographicalIndication || "Regional Alentejano"}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                    {dossier.vintage ? `Safra ${dossier.vintage}` : "Safra 2025"}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight truncate font-display" title={`${dossier.brand} · ${dossier.productName}`}>
                  {dossier.brand || "Tapada do Fidalgo"} · {dossier.productName || "Vinho Fino Tinto Seco"}
                </h2>
              </div>
            </div>

            {/* Separador vertical */}
            <div className="hidden lg:block h-10 w-px bg-stone-200 flex-shrink-0" />

            {/* Bloco 2: Cliente / Importador */}
            <div className="min-w-0 lg:min-w-[200px] lg:max-w-[240px]">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-0.5">
                CLIENTE / IMPORTADOR
              </span>
              <p className="text-xs sm:text-sm font-bold text-stone-900 truncate" title={dossier.importerName}>
                {dossier.importerName || "BARRINHAS Comércio e Importação de Be..."}
              </p>
              <span className="text-[11px] text-stone-500 font-medium block">
                CNPJ: 36.167.492/0001-51
              </span>
            </div>

            {/* Separador vertical */}
            <div className="hidden lg:block h-10 w-px bg-stone-200 flex-shrink-0" />

            {/* Bloco 3: Produtor / Origem */}
            <div className="min-w-0 lg:min-w-[180px] lg:max-w-[220px]">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-0.5">
                PRODUTOR / ORIGEM
              </span>
              <p className="text-xs sm:text-sm font-bold text-stone-900 truncate" title={dossier.exporterName ?? dossier.producerName ?? "Granacer - Adm. de Ben..."}>
                {dossier.exporterName || dossier.producerName || "Granacer - Adm. de Ben..."}
              </p>
            </div>

            {/* Separador vertical */}
            <div className="hidden lg:block h-10 w-px bg-stone-200 flex-shrink-0" />

            {/* Bloco 4: Responsável Técnico */}
            <div className="flex items-center justify-between lg:justify-start lg:gap-4 min-w-0 lg:min-w-[210px]">
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-stone-200 shadow-2xs flex-shrink-0 bg-stone-100">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                    alt="Foto do Responsável Técnico"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block leading-tight">
                    RESPONSÁVEL TÉCNICO
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-stone-900 leading-tight mt-0.5">
                    {dossier.assignedTo?.name ? dossier.assignedTo.name.replace(/demo/gi, "Teste") : "Analista Teste"}
                  </p>
                </div>
              </div>
              <div className="text-right lg:text-left text-[10px] text-stone-400 font-medium leading-tight pl-2 border-l border-stone-200">
                <div>
                  Atualização: <span className="text-stone-700 font-semibold">{format(new Date(dossier.updatedAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
                <div className="text-stone-700 font-semibold mt-0.5">
                  {format(new Date(dossier.updatedAt), "HH:mm", { locale: ptBR })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 5 ABAS UNIFICADAS DO WORKSPACE */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="no-print h-auto bg-transparent p-0 flex items-center space-x-2 border-b border-stone-200 pb-1 text-xs font-semibold overflow-x-auto rounded-none w-full justify-start">
          <TabsTrigger
            value="overview"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-all focus:outline-none data-[state=active]:text-white data-[state=active]:bg-[#722f37] data-[state=active]:shadow-sm"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-all data-[state=active]:text-white data-[state=active]:bg-[#722f37] data-[state=active]:shadow-sm"
          >
            <span>Documentos</span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-stone-200 text-stone-700 data-[state=active]:bg-white/20 data-[state=active]:text-white">
              {documents.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="review"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-all data-[state=active]:text-white data-[state=active]:bg-[#722f37] data-[state=active]:shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#722f37] data-[state=active]:text-white" />
            <span>Revisão</span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#722f37] text-white shadow-xs data-[state=active]:bg-white data-[state=active]:text-[#722f37]">
              {alerts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="decision"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-all data-[state=active]:text-white data-[state=active]:bg-[#722f37] data-[state=active]:shadow-sm"
          >
            <span>Decisão &amp; Relatório</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-all data-[state=active]:text-white data-[state=active]:bg-[#722f37] data-[state=active]:shadow-sm"
          >
            <span>Histórico</span>
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-stone-200 text-stone-600 data-[state=active]:bg-white/20 data-[state=active]:text-white">
              {auditEvents.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* 1. VISÃO GERAL */}
        <TabsContent value="overview">
          <OverviewTab
            dossier={dossier}
            missingRequiredDocuments={missingRequiredDocuments}
            documents={documents}
            onNavigateToDocuments={() => setActiveTab("documents")}
          />
        </TabsContent>

        {/* 2. DOCUMENTOS */}
        <TabsContent value="documents">
          <DocumentsTab
            dossierId={dossier.id}
            documents={documents}
            extractedFields={extractedFields}
            isSimulated={isExtractionSimulated}
          />
        </TabsContent>

        {/* 3. REVISÃO (WORKSPACE DE CONFERÊNCIA 3 COLUNAS) */}
        <TabsContent value="review">
          <ReviewClient
            embedded={true}
            tenantRole={tenant.role}
            dossier={{
              id: dossier.id,
              internalNumber: dossier.internalNumber,
              importerName: dossier.importerName,
              exporterName: dossier.exporterName,
              producerName: dossier.producerName,
              countryOrigin: dossier.countryOrigin,
              brand: dossier.brand,
              productName: dossier.productName,
              vintage: dossier.vintage,
              geographicalIndication: dossier.geographicalIndication,
              batchNumber: dossier.batchNumber,
              packageType: dossier.packageType,
              packageCount: dossier.packageCount,
              unitsPerPackage: dossier.unitsPerPackage,
              unitCapacityLiters: dossier.unitCapacityLiters,
              calculatedVolumeLiters: dossier.calculatedVolumeLiters,
              informedVolumeLiters: dossier.informedVolumeLiters,
              status: dossier.status,
              complianceScore: dossier.complianceScore,
              items:
                dossier.items && dossier.items.length > 0
                  ? dossier.items.map((i) => ({
                      id: i.id,
                      itemNumber: i.itemNumber,
                      productName: i.productName,
                      brand: i.brand,
                      batchNumber: i.batchNumber,
                      packageCount: i.packageCount,
                      totalVolumeLiters: i.totalVolumeLiters,
                    }))
                  : [
                      {
                        id: "default-item",
                        itemNumber: 1,
                        productName: dossier.productName,
                        brand: dossier.brand,
                        batchNumber: dossier.batchNumber,
                        packageCount: dossier.packageCount,
                        totalVolumeLiters: dossier.calculatedVolumeLiters ?? dossier.informedVolumeLiters,
                      },
                    ],
            }}
            documents={documents.map((d) => ({
              id: d.id,
              documentType: d.documentType,
              filename: d.filename,
              checksum: d.checksum,
              currentVersion: d.currentVersion ?? 1,
              extractionStatus: d.extractionStatus,
              confidenceScore: d.confidenceScore,
              versionsCount: d.versionsCount ?? 1,
            }))}
            extractedFields={extractedFields}
            alerts={alerts.map((a) => ({
              id: a.id,
              ruleCode: a.ruleCode,
              ruleName: a.ruleName,
              ruleDescription: a.ruleDescription ?? "",
              sourceReference: a.sourceReference ?? null,
              severity: a.severity,
              status: a.status,
              title: a.title,
              message: a.message,
              recommendation: a.recommendation,
              evidence: a.evidence,
              reviewComment: a.reviewComment,
              reviewedByName: a.reviewedByName,
              createdAt: a.createdAt,
              actions: a.actions ?? [],
            }))}
          />
        </TabsContent>

        {/* 4. DECISÃO & RELATÓRIO */}
        <TabsContent value="decision">
          <ReportTab
            dossier={dossier}
            reports={reports}
            validationRuns={validationRuns}
            alerts={alerts}
          />
        </TabsContent>

        {/* 5. HISTÓRICO (AUDITORIA) */}
        <TabsContent value="history">
          <AuditTab events={auditEvents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
