"use server";

import { revalidatePath } from "next/cache";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import type { DocumentType } from "@/lib/constants";
import { classifyDocument, matchDocumentToItem } from "@/lib/extraction/classifier";
import { getExtractionAdapter } from "@/lib/extraction/service";
import type { DossierContext } from "@/lib/extraction/types";
import { assertCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";
import type { ActionResult } from "./dossiers";
import { runDossierValidation } from "./validation";

export async function uploadDocument(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const tenant = await requireTenant();
  assertCapability(tenant.role, "DOCUMENT_UPLOAD");

  const dossierId = String(formData.get("dossierId") ?? "");
  const inputDocType = formData.get("documentType") ? String(formData.get("documentType")) : null;
  const inputItemId = formData.get("itemId") ? String(formData.get("itemId")) : null;
  const replaceDocumentId = formData.get("replaceDocumentId") ? String(formData.get("replaceDocumentId")) : null;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo para enviar." };
  }

  const dossier = await prisma.dossier.findFirst({
    where: { id: dossierId, organizationId: tenant.organizationId },
    include: { items: true },
  });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  // 1. Classificação automática heurística se não especificado pelo usuário
  let documentType: DocumentType = "outro";
  if (inputDocType && inputDocType !== "outro") {
    documentType = inputDocType as DocumentType;
  } else {
    const classification = classifyDocument(file.name);
    documentType = classification.documentType;
  }

  // 2. Persiste o arquivo e calcula SHA-256
  const saved = await saveUploadedFile(tenant.organizationId, dossierId, file);

  // 3. Versionamento documental não destrutivo:
  // Se for substituição explícita ou já existir documento do mesmo tipo para o mesmo item/dossiê
  let targetDoc = replaceDocumentId
    ? await prisma.document.findFirst({ where: { id: replaceDocumentId, dossierId } })
    : null;

  if (!targetDoc && documentType !== "outro") {
    targetDoc = await prisma.document.findFirst({
      where: {
        dossierId,
        organizationId: tenant.organizationId,
        documentType,
        ...(inputItemId ? { itemId: inputItemId } : {}),
      },
    });
  }

  let finalDocId: string;

  if (targetDoc) {
    // Nova versão de documento existente
    const newVersionNumber = (targetDoc.currentVersion ?? 1) + 1;

    // Desativa a versão anterior
    await prisma.documentVersion.updateMany({
      where: { documentId: targetDoc.id, isCurrent: true },
      data: { isCurrent: false, supersededAt: new Date() },
    });

    // Cria o registro da nova versão
    await prisma.documentVersion.create({
      data: {
        documentId: targetDoc.id,
        versionNumber: newVersionNumber,
        filename: file.name,
        filePath: saved.filePath,
        size: saved.size,
        checksum: saved.checksum,
        isCurrent: true,
        uploadedById: tenant.userId,
      },
    });

    // Atualiza o documento principal
    await prisma.document.update({
      where: { id: targetDoc.id },
      data: {
        filename: file.name,
        filePath: saved.filePath,
        size: saved.size,
        checksum: saved.checksum,
        currentVersion: newVersionNumber,
        uploadStatus: "enviado",
        extractionStatus: "pendente",
        ...(inputItemId ? { itemId: inputItemId } : {}),
      },
    });

    finalDocId = targetDoc.id;

    // Se haviam alertas vinculados a este dossiê, registra no histórico a substituição
    const openAlerts = await prisma.validationAlert.findMany({
      where: { dossierId, status: "aberto" },
    });
    for (const alert of openAlerts) {
      await prisma.findingAction.create({
        data: {
          alertId: alert.id,
          userId: tenant.userId,
          actionType: "DOCUMENTO_SUBSTITUIDO",
          reason: `Documento [${documentType}] atualizado para v${newVersionNumber} (${file.name}). Revalidação acionada.`,
          newStatus: alert.status,
        },
      });
    }
  } else {
    // Primeiro upload deste tipo de documento
    const newDoc = await prisma.document.create({
      data: {
        organizationId: tenant.organizationId,
        dossierId,
        itemId: inputItemId || null,
        documentType,
        filename: file.name,
        filePath: saved.filePath,
        mimeType: file.type || "application/octet-stream",
        size: saved.size,
        checksum: saved.checksum,
        currentVersion: 1,
        uploadStatus: "enviado",
        extractionStatus: "pendente",
        uploadedById: tenant.userId,
      },
    });

    // Cria a v1 no versionamento
    await prisma.documentVersion.create({
      data: {
        documentId: newDoc.id,
        versionNumber: 1,
        filename: file.name,
        filePath: saved.filePath,
        size: saved.size,
        checksum: saved.checksum,
        isCurrent: true,
        uploadedById: tenant.userId,
      },
    });

    finalDocId = newDoc.id;
  }

  // Atualiza ciclo do dossiê se ainda estava em rascunho
  if (dossier.status === "rascunho") {
    await prisma.dossier.update({ where: { id: dossierId }, data: { status: "documentos_pendentes" } });
  }

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId,
    action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
    entityType: "document",
    entityId: finalDocId,
    after: { documentType, filename: file.name, checksum: saved.checksum },
  });

  // Automação pós-upload: extração e validação imediatas
  try {
    await extractDocumentFields(finalDocId);
    await runDossierValidation(dossierId);
  } catch (err) {
    console.error("Falha na automação pós-upload:", err);
  }

  revalidatePath(`/painel/dossiers/${dossierId}`);
  return { ok: true, data: { id: finalDocId } };
}

export async function changeDocumentType(documentId: string, documentType: DocumentType): Promise<ActionResult> {
  const tenant = await requireTenant();
  assertCapability(tenant.role, "DOCUMENT_REVIEW");

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

  // Re-extrai e valida com o novo tipo
  try {
    await extractDocumentFields(documentId);
    await runDossierValidation(document.dossierId);
  } catch (err) {
    console.error("Erro na re-extração pós-mudança de tipo:", err);
  }

  revalidatePath(`/painel/dossiers/${document.dossierId}`);
  return { ok: true };
}

export async function extractDocumentFields(documentId: string): Promise<ActionResult<{ fieldsExtracted: number }>> {
  const tenant = await requireTenant();
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: tenant.organizationId },
    include: {
      dossier: {
        include: { items: true },
      },
      item: true,
    },
  });
  if (!document) return { ok: false, error: "Documento não encontrado." };

  await prisma.document.update({ where: { id: documentId }, data: { extractionStatus: "processando" } });

  const adapter = getExtractionAdapter();
  
  // Se o documento estiver associado a um item específico, usa as especificações do item
  const item = document.item;
  const dossierContext: DossierContext = {
    importerName: document.dossier.importerName,
    exporterName: document.dossier.exporterName,
    producerName: document.dossier.producerName,
    countryOrigin: document.dossier.countryOrigin,
    productName: item?.productName ?? document.dossier.productName,
    brand: item?.brand ?? document.dossier.brand,
    vintage: item?.vintage ?? document.dossier.vintage,
    geographicalIndication: item?.geographicalIndication ?? document.dossier.geographicalIndication,
    batchNumber: item?.batchNumber ?? document.dossier.batchNumber,
    packageType: item?.packageType ?? document.dossier.packageType,
    packageCount: item?.packageCount ?? document.dossier.packageCount,
    unitsPerPackage: item?.unitsPerPackage ?? document.dossier.unitsPerPackage,
    unitCapacityLiters: item?.unitCapacityLiters ?? document.dossier.unitCapacityLiters,
    informedVolumeLiters: item?.totalVolumeLiters ?? document.dossier.informedVolumeLiters,
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
        itemId: document.itemId,
        documentId,
        fieldKey: f.key,
        fieldLabel: f.key,
        fieldValue: f.value,
        normalizedValue: f.value.toUpperCase(),
        confidence: f.confidence,
      })),
    });
  }

  // Associação inteligente de item se não estava associado antes
  if (!document.itemId && document.dossier.items.length > 0) {
    const fieldsMap: Record<string, string | undefined> = {};
    for (const f of extracted) {
      fieldsMap[f.key] = f.value;
    }
    const itemMatch = matchDocumentToItem(fieldsMap, document.dossier.items);
    if (itemMatch && itemMatch.matchedItemId && itemMatch.confidence >= 0.7) {
      await prisma.document.update({
        where: { id: documentId },
        data: { itemId: itemMatch.matchedItemId },
      });
      await prisma.extractedField.updateMany({
        where: { documentId },
        data: { itemId: itemMatch.matchedItemId },
      });
    }
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
    after: { fieldsExtracted: extracted.length },
  });

  revalidatePath(`/painel/dossiers/${document.dossierId}`);
  return { ok: true, data: { fieldsExtracted: extracted.length } };
}

