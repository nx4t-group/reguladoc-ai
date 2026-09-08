import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export interface SavedFile {
  filePath: string;
  checksum: string;
  size: number;
}

function safeFileName(originalName: string): string {
  return `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
}

/**
 * Storage local em disco — usado em desenvolvimento e sempre que
 * `BLOB_READ_WRITE_TOKEN` não está configurado. Os arquivos ficam em
 * `storage/uploads/<organizationId>/<dossierId>/`, fora do diretório público
 * do Next — nunca servidos diretamente sem passar por uma server action que
 * já valida a organização do usuário.
 */
async function saveLocal(organizationId: string, dossierId: string, file: File, buffer: Buffer): Promise<SavedFile> {
  const dir = path.join(STORAGE_ROOT, organizationId, dossierId);
  await mkdir(dir, { recursive: true });

  const safeName = safeFileName(file.name);
  const absolutePath = path.join(dir, safeName);
  await writeFile(absolutePath, buffer);

  return {
    filePath: path.posix.join("storage", "uploads", organizationId, dossierId, safeName),
    checksum: "",
    size: buffer.byteLength,
  };
}

/**
 * Storage em produção (Vercel): usa Vercel Blob quando
 * `BLOB_READ_WRITE_TOKEN` está definido (criado automaticamente ao adicionar
 * o storage "Blob" a um projeto Vercel). Necessário porque hospedagem
 * serverless não mantém um filesystem persistente entre execuções.
 */
async function saveBlob(organizationId: string, dossierId: string, file: File, buffer: Buffer): Promise<SavedFile> {
  const { put } = await import("@vercel/blob");
  const safeName = safeFileName(file.name);
  const pathname = `uploads/${organizationId}/${dossierId}/${safeName}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: file.type || "application/octet-stream",
    addRandomSuffix: true,
  });

  return {
    filePath: blob.url,
    checksum: "",
    size: buffer.byteLength,
  };
}

export async function saveUploadedFile(organizationId: string, dossierId: string, file: File): Promise<SavedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = `sha256-${createHash("sha256").update(buffer).digest("hex").slice(0, 16)}`;

  const saved = process.env.BLOB_READ_WRITE_TOKEN
    ? await saveBlob(organizationId, dossierId, file, buffer)
    : await saveLocal(organizationId, dossierId, file, buffer);

  return { ...saved, checksum };
}

/**
 * Lê o conteúdo de um documento já salvo, independentemente do adapter usado
 * no upload — `filePath` é uma URL (Vercel Blob) ou um caminho relativo em
 * disco (storage local). Usado pelos adapters de extração (ex. Gemini) para
 * ler o arquivo original.
 */
export async function readStoredFile(filePath: string): Promise<Buffer> {
  if (/^https?:\/\//.test(filePath)) {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Falha ao baixar arquivo do storage (${response.status}): ${filePath}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  const absolutePath = path.join(process.cwd(), filePath);
  return readFile(absolutePath);
}
