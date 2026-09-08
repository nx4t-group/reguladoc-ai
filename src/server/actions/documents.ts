"use server";

import { revalidatePath } from "next/cache";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import type { DocumentType } from "@/lib/constants";
import { getExtractionAdapter } from "@/lib/extraction/service";
import type { DossierContext } from "@/lib/extraction/types";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";
import type { ActionResult } from "./dossiers";
import { runDossierValidation } from "./validation";

export async function uploadDocument(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const tenant = await requireTenant();

  const dossierId = String(formData.get("dossierId") ?? "");
  const documentType = String(formData.get("documentType") ?? "outro") as DocumentType;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo para enviar." };
  }

  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  const saved = await saveUploadedFile(tenant.organizationId, dossierId, file);

  const document = await prisma.document.create({
    data: {
      organizationId: tenant.organizationId,
      dossierId,
      documentType,
      filename: file.name,
      filePath: saved.filePath,
      mimeType: file.type || "application/octet-stream",
      size: saved.size,
      checksum: saved.checksum,
      uploadStatus: "enviado",
      extractionStatus: "pendente",
      uploadedById: tenant.userId,
    },
  });

  if (dossier.status === "rascunho") {
    await prisma.dossier.update({ where: { id: dossierId }, data: { status: "documentos_pendentes" } });
  }

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId,
    action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
    entityType: "document",
    entityId: document.id,
    after: { documentType, filename: file.name },
  });

  // Automação pós-upload: extrai os campos e roda a validação imediatamente
  try {
    await extractDocumentFields(document.id);
    await runDossierValidation(dossierId);
  } catch (err) {
    console.error("Falha na automação pós-upload:", err);
  }

  revalidatePath(`/app/dossiers/${dossierId}`);
  return { ok: true, data: { id: document.id } };
}

export async function changeDocumentType(documentId: string, documentType: DocumentType): Promise<ActionResult> {
  const tenant = await requireTenant();
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId: tenant.organizationId } });
  if (!document) return { ok: false, error: "Documento não encontrado." };

  await prisma.document.update({ where: { id: documentId }, data: { documentType } });
  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId: document.dossierId,
    action: AUDIT_ACTIONS.DOCUMENT_TYPE_CHANGED,
    entityType: "document",
    entityId: documentId,
    before: { documentType: document.documentType },
    after: { documentType },
  });

  revalidatePath(`/app/dossiers/${document.dossierId}`);
  return { ok: true };
}

export async function extractDocumentFields(documentId: string): Promise<ActionResult<{ fieldsExtracted: number }>> {
  const tenant = await requireTenant();
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: tenant.organizationId },
    include: { dossier: true },
  });
  if (!document) return { ok: false, error: "Documento não encontrado." };

  await prisma.document.update({ where: { id: documentId }, data: { extractionStatus: "processando" } });

  const adapter = getExtractionAdapter();
  const dossierContext: DossierContext = {
    importerName: document.dossier.importerName,
    exporterName: document.dossier.exporterName,
    producerName: document.dossier.producerName,
    countryOrigin: document.dossier.countryOrigin,
    productName: document.dossier.productName,
    brand: document.dossier.brand,
    vintage: document.dossier.vintage,
    geographicalIndication: document.dossier.geographicalIndication,
    batchNumber: document.dossier.batchNumber,
    packageType: document.dossier.packageType,
    packageCount: document.dossier.packageCount,
    unitsPerPackage: document.dossier.unitsPerPackage,
    unitCapacityLiters: document.dossier.unitCapacityLiters,
    informedVolumeLiters: document.dossier.informedVolumeLiters,
  };

  const extracted = await adapter.extract({
    documentType: document.documentType as DocumentType,
    filename: document.filename,
    filePath: document.filePath,
    dossierContext,
  });

  await prisma.extractedField.deleteMany({ where: { documentId } });
  if (extracted.length > 0) {
    await prisma.extractedField.createMany({
      data: extracted.map((f) => ({
        organizationId: tenant.organizationId,
        dossierId: document.dossierId,
        documentId,
        fieldKey: f.key,
        fieldLabel: f.key,
        fieldValue: f.value,
        normalizedValue: f.value.toUpperCase(),
        confidence: f.confidence,
      })),
    });
  }

  const avgConfidence = extracted.length ? extracted.reduce((sum, f) => sum + f.confidence, 0) / extracted.length : null;

  await prisma.document.update({
    where: { id: documentId },
    data: { extractionStatus: "concluida", confidenceScore: avgConfidence },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId: document.dossierId,
    action: AUDIT_ACTIONS.DOCUMENT_EXTRACTED,
    entityType: "document",
    entityId: documentId,
    after: { fieldsExtracted: extracted.length, simulated: adapter.isSimulated },
  });

  revalidatePath(`/app/dossiers/${document.dossierId}`);
  return { ok: true, data: { fieldsExtracted: extracted.length } };
}
