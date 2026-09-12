"use client";

import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DossierStatusBadge } from "@/components/domain/status-badge";
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
  const criticalAlertsCount = alerts.filter(
    (a) => a.severity === "critica" && (a.status === "aberto" || a.status === "confirmado")
  ).length;

  return (
    <div className="space-y-5">
      {/* HEADER PRINCIPAL DO WORKSPACE V3 */}
      <div className="no-print space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <Link
            href="/painel/dossiers"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para lista de dossiês
          </Link>

          {/* ASSISTENTE CONTEXTUAL EM DRAWER */}
          <div className="flex items-center gap-2">
            <AssistantDrawer dossierId={dossier.id} />
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pt-1 border-t border-border/60">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{dossier.internalNumber}</h1>
              <DossierStatusBadge status={dossier.status} />

              {criticalAlertsCount > 0 ? (
                <Badge variant="critical" className="gap-1 text-xs">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {criticalAlertsCount} blocker(s)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Sem bloqueios críticos
                </Badge>
              )}

              {dossier.complianceScore != null && (
                <Badge variant="outline" className="font-mono text-xs">
                  Score: {dossier.complianceScore} pts
                </Badge>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">Cliente:</strong> {dossier.importerName}
              </span>
              <span>
                <strong className="text-foreground">Produto:</strong> {dossier.brand} · {dossier.productName}
              </span>
              <span>
                <strong className="text-foreground">Responsável:</strong> {dossier.assignedTo?.name ?? "Não atribuído"}
              </span>
              <span>
                <strong className="text-foreground">Atualizado:</strong>{" "}
                {format(new Date(dossier.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>

          <HeaderActions
            dossierId={dossier.id}
            role={tenant.role}
            status={dossier.status}
            complianceScore={dossier.complianceScore}
            hasDocuments={documents.length > 0}
            hasValidated={validationRuns.length > 0}
            hasReport={reports.length > 0}
          />
        </div>
      </div>

      {/* 5 ABAS UNIFICADAS DO WORKSPACE */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="no-print h-auto bg-muted/60 p-1 gap-0.5">
          <TabsTrigger value="overview" className="text-[13.5px] font-medium px-4 py-2">
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-[13.5px] font-medium px-4 py-2">
            Documentos ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="review" className="text-[13.5px] font-medium px-4 py-2">
            Revisão {alerts.length > 0 && `(${alerts.length})`}
          </TabsTrigger>
          <TabsTrigger value="decision" className="text-[13.5px] font-medium px-4 py-2">
            Decisão & Relatório
          </TabsTrigger>
          <TabsTrigger value="history" className="text-[13.5px] font-medium px-4 py-2">
            Histórico ({auditEvents.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. VISÃO GERAL */}
        <TabsContent value="overview">
          <OverviewTab dossier={dossier} missingRequiredDocuments={missingRequiredDocuments} />
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
              brand: dossier.brand,
              productName: dossier.productName,
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
