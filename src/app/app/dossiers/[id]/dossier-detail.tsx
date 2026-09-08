"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DossierStatusBadge } from "@/components/domain/status-badge";
import { AlertsTab } from "./alerts-tab";
import { AssistantTab } from "./assistant-tab";
import { AuditTab } from "./audit-tab";
import { DocumentsTab } from "./documents-tab";
import { FieldsTab } from "./fields-tab";
import { HeaderActions } from "./header-actions";
import { OverviewTab } from "./overview-tab";
import { ReportTab } from "./report-tab";
import type { DossierDetailProps } from "./types";
import { ValidationsTab } from "./validations-tab";

export function DossierDetail({
  tenant,
  dossier,
  documents,
  extractedFields,
  validationRuns,
  alerts,
  auditEvents,
  reports,
  appliedRuleCodes,
  allRules,
  missingRequiredDocuments,
  isExtractionSimulated,
}: DossierDetailProps) {
  void appliedRuleCodes;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Link href="/app/dossiers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dossiês
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">{dossier.internalNumber}</h1>
              <DossierStatusBadge status={dossier.status} />
              {dossier.complianceScore != null && (
                <span className="text-sm text-muted-foreground">Score: {dossier.complianceScore}/100</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {dossier.brand} · {dossier.productName} · {dossier.importerName}
            </p>
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

      <Tabs defaultValue="overview">
        <TabsList className="no-print flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="documents">Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="fields">Campos extraídos</TabsTrigger>
          <TabsTrigger value="validations">Validações</TabsTrigger>
          <TabsTrigger value="alerts">
            Alertas {alerts.length > 0 && `(${alerts.length})`}
          </TabsTrigger>
          <TabsTrigger value="assistant">Assistente</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
          <TabsTrigger value="report">Relatório</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab dossier={dossier} missingRequiredDocuments={missingRequiredDocuments} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab dossierId={dossier.id} documents={documents} extractedFields={extractedFields} isSimulated={isExtractionSimulated} />
        </TabsContent>
        <TabsContent value="fields">
          <FieldsTab documents={documents} extractedFields={extractedFields} />
        </TabsContent>
        <TabsContent value="validations">
          <ValidationsTab validationRuns={validationRuns} alerts={alerts} allRules={allRules} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsTab dossierId={dossier.id} alerts={alerts} />
        </TabsContent>
        <TabsContent value="assistant">
          <AssistantTab dossierId={dossier.id} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab events={auditEvents} />
        </TabsContent>
        <TabsContent value="report">
          <ReportTab dossier={dossier} reports={reports} validationRuns={validationRuns} alerts={alerts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
