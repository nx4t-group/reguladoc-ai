import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const SUPABASE_BUCKET = "documents";

export interface SavedFile {
  filePath: string;
  checksum: string;
  size: number;
}

function safeFileName(originalName: string): string {
  return `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
}

/**
 * Storage local em disco — usado em desenvolvimento e sempre que nenhum
 * provider de produção está configurado. Os arquivos ficam em
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
 * Storage em produção — Supabase Storage (preferencial quando SUPABASE_URL
 * está definido). Armazena no bucket `documents` com path estruturado por
 * organização e dossiê. Bucket deve ser criado como privado no painel do
 * Supabase; acesso aos arquivos é feito via signed URLs de 1 hora.
 */
async function saveSupabase(organizationId: string, dossierId: string, file: File, buffer: Buffer): Promise<SavedFile> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const safeName = safeFileName(file.name);
  const storagePath = `${organizationId}/${dossierId}/${safeName}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(`Supabase Storage upload falhou: ${error.message}`);

  return {
    filePath: `supabase://${SUPABASE_BUCKET}/${storagePath}`,
    checksum: "",
    size: buffer.byteLength,
  };
}

/**
 * Storage em produção — Vercel Blob (fallback quando BLOB_READ_WRITE_TOKEN
 * está definido mas SUPABASE_URL não está). Usado em deploys Vercel sem
 * Supabase configurado.
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

/**
 * Seleciona automaticamente o adapter de storage disponível:
 * 1. Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY definidos)
 * 2. Vercel Blob (BLOB_READ_WRITE_TOKEN definido)
 * 3. Disco local (desenvolvimento)
 */
export async function saveUploadedFile(organizationId: string, dossierId: string, file: File): Promise<SavedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = `sha256-${createHash("sha256").update(buffer).digest("hex").slice(0, 16)}`;

  let saved: SavedFile;

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    saved = await saveSupabase(organizationId, dossierId, file, buffer);
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    saved = await saveBlob(organizationId, dossierId, file, buffer);
  } else {
    saved = await saveLocal(organizationId, dossierId, file, buffer);
  }

  return { ...saved, checksum };
}

/**
 * Lê o conteúdo de um documento já salvo, independentemente do adapter
 * usado no upload:
 * - `supabase://bucket/path` → gera signed URL temporária e baixa
 * - `https://...` → baixa diretamente (Vercel Blob ou URL pública)
 * - caminho relativo → lê do disco local
 * Usado pelos adapters de extração (ex. Gemini) para ler o arquivo original.
 */
export async function readStoredFile(filePath: string): Promise<Buffer> {
  // Supabase Storage — protocolo interno `supabase://bucket/path`
  if (filePath.startsWith("supabase://")) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const withoutScheme = filePath.replace("supabase://", "");
    const slashIdx = withoutScheme.indexOf("/");
    const bucket = withoutScheme.slice(0, slashIdx);
    const storagePath = withoutScheme.slice(slashIdx + 1);

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600); // 1 hora

    if (error || !data?.signedUrl) {
      throw new Error(`Falha ao gerar signed URL do Supabase Storage: ${error?.message}`);
    }

    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error(`Falha ao baixar arquivo do Supabase (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }

  // URL pública (Vercel Blob ou qualquer HTTP)
  if (/^https?:\/\//.test(filePath)) {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Falha ao baixar arquivo do storage (${response.status}): ${filePath}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  // Disco local (desenvolvimento)
  const absolutePath = path.join(process.cwd(), filePath);
  return readFile(absolutePath);
}
