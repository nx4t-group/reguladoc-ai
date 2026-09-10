import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { ReviewClient } from "./review-client";

export default async function DossierReviewPage({ params }: { params: { id: string } }) {
  const tenant = await requireTenant();

  const dossier = await prisma.dossier.findFirst({
    where: { id: params.id, organizationId: tenant.organizationId, deletedAt: null },
    include: {
      items: true,
    },
  });
  if (!dossier) notFound();

  const [alerts, documents, extractedFields] = await Promise.all([
    prisma.validationAlert.findMany({
      where: { dossierId: dossier.id },
      include: {
        rule: true,
        reviewedBy: { select: { name: true } },
        actions: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.document.findMany({
      where: { dossierId: dossier.id },
      include: {
        versions: { orderBy: { versionNumber: "desc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.extractedField.findMany({
      where: { dossierId: dossier.id },
      orderBy: { fieldKey: "asc" },
    }),
  ]);

  return (
    <ReviewClient
      tenantRole={tenant.role}
      dossier={{
        id: dossier.id,
        internalNumber: dossier.internalNumber,
        brand: dossier.brand,
        productName: dossier.productName,
        status: dossier.status,
        complianceScore: dossier.complianceScore,
        items: dossier.items.map((it) => ({
          id: it.id,
          itemNumber: it.itemNumber,
          productName: it.productName,
          brand: it.brand,
          batchNumber: it.batchNumber,
          packageCount: it.packageCount,
          totalVolumeLiters: it.totalVolumeLiters,
        })),
      }}
      documents={documents.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        filename: d.filename,
        checksum: d.checksum,
        currentVersion: d.currentVersion ?? 1,
        extractionStatus: d.extractionStatus,
        confidenceScore: d.confidenceScore,
        versionsCount: d.versions.length,
      }))}
      extractedFields={extractedFields.map((f) => ({
        id: f.id,
        documentId: f.documentId,
        fieldKey: f.fieldKey,
        fieldValue: f.fieldValue,
        confidence: f.confidence,
      }))}
      alerts={alerts.map((a) => ({
        id: a.id,
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
        createdAt: a.createdAt.toISOString(),
        actions: a.actions.map((act) => ({
          id: act.id,
          actionType: act.actionType,
          reason: act.reason,
          previousStatus: act.previousStatus,
          newStatus: act.newStatus,
          createdAt: act.createdAt.toISOString(),
        })),
      }))}
    />
  );
}

