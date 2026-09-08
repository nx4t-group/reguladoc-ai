"use server";

import { DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENT_TYPES, type AlertSeverity, type DocumentType } from "@/lib/constants";
import { llmAssistant, type AssistantDossierSnapshot } from "@/lib/llm/assistant";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import type { ActionResult } from "./dossiers";

async function buildSnapshot(dossierId: string, organizationId: string): Promise<AssistantDossierSnapshot | null> {
  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId } });
  if (!dossier) return null;

  const [documents, alerts] = await Promise.all([
    prisma.document.findMany({ where: { dossierId }, select: { documentType: true } }),
    prisma.validationAlert.findMany({
      where: { dossierId },
      select: { title: true, severity: true, message: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const presentTypes = new Set(documents.map((d) => d.documentType));
  const missingDocumentLabels = REQUIRED_DOCUMENT_TYPES.filter((t) => !presentTypes.has(t)).map(
    (t: DocumentType) => DOCUMENT_TYPE_LABELS[t],
  );

  return {
    internalNumber: dossier.internalNumber,
    productName: dossier.productName,
    brand: dossier.brand,
    status: dossier.status,
    complianceScore: dossier.complianceScore,
    documentsCount: documents.length,
    missingDocumentLabels,
    alerts: alerts.map((a) => ({ title: a.title, severity: a.severity as AlertSeverity, message: a.message, status: a.status })),
  };
}

export async function askAssistant(dossierId: string, question: string): Promise<ActionResult<{ answer: string; isSimulated: boolean }>> {
  const tenant = await requireTenant();
  const snapshot = await buildSnapshot(dossierId, tenant.organizationId);
  if (!snapshot) return { ok: false, error: "Dossiê não encontrado." };

  const answer = await llmAssistant.ask(question, snapshot);
  return { ok: true, data: { answer, isSimulated: llmAssistant.isSimulated } };
}
