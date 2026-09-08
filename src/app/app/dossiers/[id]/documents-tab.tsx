"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, RefreshCw, ScanText, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/constants";
import { changeDocumentType, extractDocumentFields, uploadDocument } from "@/server/actions/documents";
import { formatBytes } from "./format";
import type { DocumentData, ExtractedFieldData } from "./types";

const EXTRACTION_LABEL: Record<string, string> = {
  pendente: "Pendente",
  processando: "Processando…",
  concluida: "Concluída",
  erro: "Erro",
};

export function DocumentsTab({
  dossierId,
  documents,
  extractedFields,
  isSimulated,
}: {
  dossierId: string;
  documents: DocumentData[];
  extractedFields: ExtractedFieldData[];
  isSimulated: boolean;
}) {
  const router = useRouter();
  const [uploadType, setUploadType] = React.useState<DocumentType>("outro");
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<DocumentData | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.set("dossierId", dossierId);
        formData.set("documentType", uploadType);
        formData.set("file", file);
        const result = await uploadDocument(formData);
        if (!result.ok) toast.error(result.error ?? `Falha ao enviar ${file.name}`);
      }
      toast.success("Upload concluído — extração e validação já rodaram automaticamente.");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function handleExtract(documentId: string) {
    setBusyId(documentId);
    try {
      const result = await extractDocumentFields(documentId);
      if (!result.ok) {
        toast.error(result.error ?? "Falha na extração.");
        return;
      }
      toast.success(`${result.data?.fieldsExtracted ?? 0} campo(s) extraído(s) (modo simulado).`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleTypeChange(documentId: string, type: DocumentType) {
    const result = await changeDocumentType(documentId, type);
    if (!result.ok) toast.error(result.error ?? "Falha ao alterar tipo.");
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Enviar documentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="text-sm text-muted-foreground">Tipo do documento a enviar:</span>
            <Select value={uploadType} onValueChange={(v) => setUploadType(v as DocumentType)}>
              <SelectTrigger className="sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Arraste e solte o arquivo aqui, ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG ou DOCX — extração e validação rodam automaticamente após o envio</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>
          {uploading && <p className="text-xs text-muted-foreground">Enviando e processando (extração + validação)…</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Documentos do dossiê ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Nenhum documento enviado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Extração</TableHead>
                  <TableHead>Confiança</TableHead>
                  <TableHead>Enviado por</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <button className="text-left font-medium hover:underline" onClick={() => setSelected(doc)}>
                        {doc.filename}
                      </button>
                      <p className="text-xs text-muted-foreground">{formatBytes(doc.size)}</p>
                    </TableCell>
                    <TableCell>
                      <Select value={doc.documentType} onValueChange={(v) => handleTypeChange(doc.id, v as DocumentType)}>
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {DOCUMENT_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.extractionStatus === "concluida" ? "success" : doc.extractionStatus === "erro" ? "destructive" : "neutral"}>
                        {EXTRACTION_LABEL[doc.extractionStatus] ?? doc.extractionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {doc.confidenceScore != null ? (
                        <div className="flex items-center gap-2">
                          <Progress value={doc.confidenceScore * 100} className="h-1.5 w-16" />
                          <span className="text-xs text-muted-foreground">{Math.round(doc.confidenceScore * 100)}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.uploadedByName}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled={busyId === doc.id} onClick={() => handleExtract(doc.id)}>
                        {doc.extractionStatus === "concluida" ? <RefreshCw className="h-3.5 w-3.5" /> : <ScanText className="h-3.5 w-3.5" />}
                        {doc.extractionStatus === "concluida" ? "Reprocessar" : "Extrair campos"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {documents.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {isSimulated
                ? "Modo simulado: campos extraídos automaticamente a partir dos dados do dossiê (sem OCR real configurado)."
                : "OCR real ativo: campos extraídos por leitura do arquivo via Google Gemini."}
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.filename}</SheetTitle>
                <SheetDescription>{DOCUMENT_TYPE_LABELS[selected.documentType as DocumentType] ?? selected.documentType}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 py-4 text-sm">
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                  Pré-visualização binária não disponível neste MVP — o arquivo fica salvo com checksum de integridade (localmente em disco ou no Vercel Blob, dependendo do ambiente).
                </div>
                <dl className="grid grid-cols-2 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">Tamanho</dt>
                  <dd>{formatBytes(selected.size)}</dd>
                  <dt className="text-muted-foreground">Tipo MIME</dt>
                  <dd>{selected.mimeType}</dd>
                  <dt className="text-muted-foreground">Checksum</dt>
                  <dd className="truncate">{selected.checksum}</dd>
                  <dt className="text-muted-foreground">Enviado por</dt>
                  <dd>{selected.uploadedByName}</dd>
                  <dt className="text-muted-foreground">Data</dt>
                  <dd>{format(new Date(selected.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</dd>
                </dl>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campos extraídos</p>
                  <div className="space-y-1.5">
                    {extractedFields
                      .filter((f) => f.documentId === selected.id)
                      .map((f) => (
                        <div key={f.id} className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5">
                          <span className="text-xs text-muted-foreground">{f.fieldKey}</span>
                          <span className="text-xs font-medium">{f.fieldValue}</span>
                        </div>
                      ))}
                    {extractedFields.filter((f) => f.documentId === selected.id).length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhum campo extraído ainda.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
