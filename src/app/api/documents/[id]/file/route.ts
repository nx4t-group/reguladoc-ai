import { NextResponse } from "next/server";

import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/constants";
import { generatePreviewPdf } from "@/lib/pdf-preview";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/storage";
import { requireTenant } from "@/lib/tenant";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireTenant();
    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: {
        dossier: true,
        versions: { where: { isCurrent: true }, take: 1 },
        extractedFields: true,
      },
    });

    if (!document) {
      return new NextResponse("Documento não encontrado.", { status: 404 });
    }

    const currentVersion = document.versions[0];
    const targetFilePath = currentVersion?.filePath || document.filePath;

    let buffer: Buffer | null = null;

    if (targetFilePath) {
      try {
        buffer = await readStoredFile(targetFilePath);
      } catch {
        // Se o arquivo físico não for encontrado em disco (ex: dados semeados ou mock),
        // geramos dinamicamente um PDF estruturado em memória
        buffer = null;
      }
    }

    if (!buffer) {
      const docLabel =
        DOCUMENT_TYPE_LABELS[document.documentType as DocumentType] ??
        document.documentType;

      buffer = generatePreviewPdf({
        title: docLabel,
        documentType: document.documentType,
        filename: document.filename,
        checksum: document.checksum,
        version: document.currentVersion ?? 1,
        dossierNumber: document.dossier?.internalNumber,
        productName: document.dossier?.productName,
        brand: document.dossier?.brand,
        importer: document.dossier?.importerName,
        fields: document.extractedFields.map((f) => ({
          key: f.fieldKey,
          value: f.fieldValue,
          confidence: f.confidence,
        })),
      });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          document.filename
        )}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Erro ao servir arquivo do documento:", error);
    return new NextResponse("Erro ao processar documento.", { status: 500 });
  }
}
