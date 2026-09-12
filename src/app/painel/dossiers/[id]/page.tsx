import { notFound } from "next/navigation";

import { DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENT_TYPES, type DocumentType } from "@/lib/constants";
import { isExtractionSimulated } from "@/lib/extraction/service";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { DossierDetail } from "./dossier-detail";

export default async function DossierDetailPage({ params }: { params: { id: string } }) {
  const tenant = await requireTenant();

  const dossier = await prisma.dossier.findFirst({
    where: { id: params.id, organizationId: tenant.organizationId, deletedAt: null },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { itemNumber: "asc" } },
    },
  });
  if (!dossier) notFound();

  const [documents, extractedFields, validationRuns, alerts, auditEvents, reports, members, rules] = await Promise.all([
    prisma.document.findMany({
      where: { dossierId: dossier.id },
      include: {
        uploadedBy: { select: { name: true } },
        versions: { orderBy: { versionNumber: "desc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.extractedField.findMany({ where: { dossierId: dossier.id }, orderBy: { fieldKey: "asc" } }),
    prisma.validationRun.findMany({ where: { dossierId: dossier.id }, orderBy: { startedAt: "desc" } }),
    prisma.validationAlert.findMany({
      where: { dossierId: dossier.id },
      include: {
        rule: true,
        reviewedBy: { select: { name: true } },
        confirmedBy: { select: { name: true } },
        actions: { orderBy: { createdAt: "desc" } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.auditEvent.findMany({
      where: { dossierId: dossier.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.report.findMany({
      where: { dossierId: dossier.id },
      include: { generatedBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: tenant.organizationId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.validationRule.findMany({
      where: { OR: [{ organizationId: tenant.organizationId }, { organizationId: null }] },
    }),
  ]);

  const presentTypes = new Set(documents.map((d) => d.documentType));
  const missingRequiredDocuments = REQUIRED_DOCUMENT_TYPES.filter((t: DocumentType) => !presentTypes.has(t)).map((t) => ({
    type: t,
    label: DOCUMENT_TYPE_LABELS[t],
  }));

  return (
    <DossierDetail
      tenant={tenant}
      dossier={{
        id: dossier.id,
        internalNumber: dossier.internalNumber,
        importerName: dossier.importerName,
        exporterName: dossier.exporterName,
        producerName: dossier.producerName,
        countryOrigin: dossier.countryOrigin,
        productName: dossier.productName,
        brand: dossier.brand,
        vintage: dossier.vintage,
        geographicalIndication: dossier.geographicalIndication,
        batchNumber: dossier.batchNumber,
        packageType: dossier.packageType,
        packageCount: dossier.packageCount,
        unitsPerPackage: dossier.unitsPerPackage,
        unitCapacityLiters: dossier.unitCapacityLiters,
        informedVolumeLiters: dossier.informedVolumeLiters,
        calculatedVolumeLiters: dossier.calculatedVolumeLiters,
        status: dossier.status,
        complianceScore: dossier.complianceScore,
        assignedTo: dossier.assignedTo,
        createdBy: dossier.createdBy,
        createdAt: dossier.createdAt.toISOString(),
        updatedAt: dossier.updatedAt.toISOString(),
        items: dossier.items.map((i) => ({
          id: i.id,
          itemNumber: i.itemNumber,
          productName: i.productName,
          brand: i.brand,
          vintage: i.vintage,
          geographicalIndication: i.geographicalIndication,
          batchNumber: i.batchNumber,
          packageType: i.packageType,
          packageCount: i.packageCount,
          unitsPerPackage: i.unitsPerPackage,
          unitCapacityLiters: i.unitCapacityLiters,
          totalVolumeLiters: i.totalVolumeLiters,
        })),
      }}
      documents={documents.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        filename: d.filename,
        mimeType: d.mimeType,
        size: d.size,
        checksum: d.checksum,
        currentVersion: d.currentVersion,
        uploadStatus: d.uploadStatus,
        extractionStatus: d.extractionStatus,
        confidenceScore: d.confidenceScore,
        uploadedByName: d.uploadedBy.name,
        createdAt: d.createdAt.toISOString(),
        versionsCount: d.versions.length,
      }))}
      extractedFields={extractedFields.map((f) => ({
        id: f.id,
        documentId: f.documentId,
        fieldKey: f.fieldKey,
        fieldValue: f.fieldValue,
        confidence: f.confidence,
      }))}
      validationRuns={validationRuns.map((r) => ({
        id: r.id,
        status: r.status,
        score: r.score,
        rulesVersionSnapshot: r.rulesVersionSnapshot,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      }))}
      alerts={alerts.map((a) => ({
        id: a.id,
        validationRunId: a.validationRunId,
        ruleId: a.ruleId,
        ruleCode: a.rule.code,
        ruleName: a.rule.name,
        ruleDescription: a.rule.description,
        sourceReference: a.rule.sourceReference,
        severity: a.severity,
        status: a.status,
        title: a.title,
        message: a.message,
        recommendation: a.recommendation,
        evidence: a.evidence,
        reviewComment: a.reviewComment,
        reviewedByName: a.reviewedBy?.name ?? null,
        confirmedByName: a.confirmedBy?.name ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        actions: a.actions.map((act) => ({
          id: act.id,
          actionType: act.actionType,
          reason: act.reason,
          previousStatus: act.previousStatus,
          newStatus: act.newStatus,
          createdAt: act.createdAt.toISOString(),
        })),
      }))}
      auditEvents={auditEvents.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        beforeJson: e.beforeJson,
        afterJson: e.afterJson,
        userName: e.user?.name ?? "Sistema",
        createdAt: e.createdAt.toISOString(),
      }))}
      reports={reports.map((r) => ({
        id: r.id,
        status: r.status,
        title: r.title,
        summary: r.summary,
        generatedByName: r.generatedBy.name,
        approvedByName: r.approvedBy?.name ?? null,
        generatedAt: r.generatedAt.toISOString(),
        approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      }))}
      members={members.map((m) => ({ userId: m.user.id, name: m.user.name, role: m.role }))}
      appliedRuleCodes={Array.from(new Set(alerts.map((a) => a.rule.code)))}
      allRules={rules.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        severity: r.severity,
        version: r.version,
      }))}
      missingRequiredDocuments={missingRequiredDocuments}
      isExtractionSimulated={isExtractionSimulated()}
    />
  );
}
