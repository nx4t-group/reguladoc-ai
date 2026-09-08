import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { ReviewClient } from "./review-client";

export default async function DossierReviewPage({ params }: { params: { id: string } }) {
  const tenant = await requireTenant();

  const dossier = await prisma.dossier.findFirst({
    where: { id: params.id, organizationId: tenant.organizationId, deletedAt: null },
  });
  if (!dossier) notFound();

  const [alerts, documents] = await Promise.all([
    prisma.validationAlert.findMany({
      where: { dossierId: dossier.id },
      include: { rule: true, reviewedBy: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.document.findMany({ where: { dossierId: dossier.id }, select: { id: true, documentType: true, filename: true } }),
  ]);

  return (
    <ReviewClient
      dossier={{ id: dossier.id, internalNumber: dossier.internalNumber, brand: dossier.brand, productName: dossier.productName }}
      documents={documents}
      alerts={alerts.map((a) => ({
        id: a.id,
        ruleCode: a.rule.code,
        ruleName: a.rule.name,
        ruleDescription: a.rule.description,
        severity: a.severity,
        status: a.status,
        title: a.title,
        message: a.message,
        recommendation: a.recommendation,
        evidence: a.evidence,
        reviewComment: a.reviewComment,
        reviewedByName: a.reviewedBy?.name ?? null,
        createdAt: a.createdAt.toISOString(),
      }))}
    />
  );
}
