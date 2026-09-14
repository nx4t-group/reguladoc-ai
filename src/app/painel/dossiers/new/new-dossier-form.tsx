"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  Sparkles,
  Download,
  FileCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { calculateTotalVolume } from "@/lib/rules/calculations";
import { createDossier, type CreateDossierInput } from "@/server/actions/dossiers";
import { uploadDocument } from "@/server/actions/documents";
import { extractInitialDossierData } from "@/server/actions/extract-dossier";
const schema = z.object({
  internalNumber: z.string().min(2, "Informe o número interno do processo."),
  importerName: z.string().min(2, "Informe o importador."),
  exporterName: z.string().optional(),
  producerName: z.string().optional(),
  countryOrigin: z.string().optional(),
  productName: z.string().min(2, "Informe o produto."),
  brand: z.string().min(1, "Informe a marca."),
  vintage: z.string().optional(),
  geographicalIndication: z.string().optional(),
  batchNumber: z.string().optional(),
  packageType: z.string().optional(),
  packageCount: z.string().optional(),
  unitsPerPackage: z.string().optional(),
  unitCapacityLiters: z.string().optional(),
  informedVolumeLiters: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "ready" | "analyzing" | "done";
  file: File;
}

const DEMO_PREFILL: FormValues = {
  internalNumber: "I2400139612",
  importerName: "BARRINHAS Comércio e Importação de Bebidas e Cereais Ltda.",
  exporterName: "Granacer - Administração de Bens, S.A.",
  producerName: "Granacer - Administração de Bens, S.A.",
  countryOrigin: "Portugal",
  productName: "Vinho Fino Tinto Seco",
  brand: "Tapada do Fidalgo",
  vintage: "2025",
  geographicalIndication: "Regional Alentejano",
  batchNumber: "LVT25260101",
  packageType: "Caixas de 6 garrafas",
  packageCount: "800",
  unitsPerPackage: "6",
  unitCapacityLiters: "0.75",
  informedVolumeLiters: "3600",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.includes("pdf")) return "📄";
  if (type.includes("image")) return "🖼️";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type.includes("excel") || type.includes("spreadsheet")) return "📊";
  return "📎";
}

export function NewDossierForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([]);
  const [extracting, setExtracting] = React.useState(false);
  const [extractedFields, setExtractedFields] = React.useState<string[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      internalNumber: "",
      importerName: "",
      exporterName: "",
      producerName: "",
      countryOrigin: "",
      productName: "",
      brand: "",
      vintage: "",
      geographicalIndication: "",
      batchNumber: "",
      packageType: "",
      packageCount: "",
      unitsPerPackage: "",
      unitCapacityLiters: "",
      informedVolumeLiters: "",
    },
  });

  const [packageCount, unitsPerPackage, unitCapacityLiters] = form.watch([
    "packageCount",
    "unitsPerPackage",
    "unitCapacityLiters",
  ]);

  const calculatedVolume = React.useMemo(() => {
    const p = Number(packageCount);
    const u = Number(unitsPerPackage);
    const c = Number(unitCapacityLiters);
    if (!p || !u || !c) return null;
    return calculateTotalVolume(p, u, c);
  }, [packageCount, unitsPerPackage, unitCapacityLiters]);

  async function performExtraction(filesToExtract: UploadedFile[]) {
    if (filesToExtract.length === 0) return;
    setExtracting(true);
    setUploadedFiles((prev) => prev.map((f) => ({ ...f, status: "analyzing" })));

    try {
      const formData = new FormData();
      filesToExtract.forEach((f) => {
        formData.append("files", f.file);
      });

      const res = await extractInitialDossierData(formData);
      if (!res.ok || !res.fields) {
        toast.error(res.error ?? "Não foi possível extrair dados dos documentos.");
        setUploadedFiles((prev) => prev.map((f) => ({ ...f, status: "ready" })));
        return;
      }

      const filledFields: string[] = [];
      Object.entries(res.fields).forEach(([key, value]) => {
        if (value) {
          form.setValue(key as keyof FormValues, String(value), { shouldDirty: true, shouldValidate: true });
          filledFields.push(key);
        }
      });

      setExtractedFields(filledFields);
      setUploadedFiles((prev) => prev.map((f) => ({ ...f, status: "done" })));

      toast.success(
        `${filledFields.length} campos preenchidos automaticamente a partir dos documentos.`,
        { description: "Revise os campos antes de criar o dossiê." }
      );
    } catch (err) {
      console.error("Erro na extração de dados:", err);
      toast.error("Ocorreu uma falha ao extrair dados dos arquivos.");
      setUploadedFiles((prev) => prev.map((f) => ({ ...f, status: "ready" })));
    } finally {
      setExtracting(false);
    }
  }

  function addFiles(files: FileList | File[]) {
    const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: "ready" as const,
      file,
    }));

    setUploadedFiles((prev) => {
      const combined = [...prev, ...newFiles];
      setTimeout(() => {
        performExtraction(combined);
      }, 150);
      return combined;
    });
  }

  function removeFile(id: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function downloadFile(uploadedFile: UploadedFile) {
    const url = URL.createObjectURL(uploadedFile.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = uploadedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleAutoFill() {
    await performExtraction(uploadedFiles);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload: CreateDossierInput = {
        ...values,
        packageCount: values.packageCount ? Number(values.packageCount) : undefined,
        unitsPerPackage: values.unitsPerPackage ? Number(values.unitsPerPackage) : undefined,
        unitCapacityLiters: values.unitCapacityLiters ? Number(values.unitCapacityLiters) : undefined,
        informedVolumeLiters: values.informedVolumeLiters ? Number(values.informedVolumeLiters) : undefined,
      };

      const result = await createDossier(payload);
      if (!result.ok || !result.data?.id) {
        toast.error(result.error ?? "Não foi possível criar o dossiê.");
        return;
      }

      const newDossierId = result.data.id;

      // Anexa os documentos enviados no dropzone ao novo dossiê
      if (uploadedFiles.length > 0) {
        toast.loading("Anexando documentos ao dossiê...", { id: "uploading-dossier-docs" });
        for (const uf of uploadedFiles) {
          try {
            const fd = new FormData();
            fd.set("dossierId", newDossierId);
            fd.set("documentType", "auto");
            fd.set("file", uf.file);
            await uploadDocument(fd);
          } catch (uploadErr) {
            console.error("Erro ao salvar arquivo no dossiê:", uploadErr);
          }
        }
        toast.dismiss("uploading-dossier-docs");
      }

      toast.success("Dossiê criado com sucesso!");
      router.push(`/painel/dossiers/${newDossierId}`);
      router.refresh();
    } catch (err) {
      console.error("Erro ao submeter formulário de dossiê:", err);
      toast.error("Ocorreu um erro ao criar o dossiê.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* ── UPLOAD DE DOCUMENTOS ── */}
        <Card className="border-2 border-dashed border-primary/20 bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FileCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Documentos do processo
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Anexe os documentos antes de preencher — a IA extrai as informações automaticamente.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-border hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.xml"
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                isDragging ? "bg-primary/20" : "bg-muted"
              }`}>
                <Upload className={`h-5 w-5 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isDragging ? "Solte os arquivos aqui" : "Clique ou arraste os documentos"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, Word, Excel, XML, imagens — Invoice, Packing List, Certificados, NF-e
                </p>
              </div>
            </div>

            {/* File list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm"
                  >
                    <span className="text-lg">{getFileIcon(f.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                    </div>
                    {/* Status badge */}
                    {f.status === "analyzing" && (
                      <Badge variant="outline" className="shrink-0 gap-1 text-xs text-primary border-primary/30 bg-primary/5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Analisando
                      </Badge>
                    )}
                    {f.status === "done" && (
                      <Badge variant="outline" className="shrink-0 gap-1 text-xs text-status-success border-status-success/30 bg-status-success/5">
                        <CheckCircle2 className="h-3 w-3" />
                        Extraído
                      </Badge>
                    )}
                    {/* Actions */}
                    <button
                      type="button"
                      title="Baixar arquivo"
                      onClick={() => downloadFile(f)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Remover arquivo"
                      onClick={() => removeFile(f.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {/* Auto-fill CTA */}
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <p className="flex-1 text-xs text-foreground">
                    {extractedFields.length > 0
                      ? `${extractedFields.length} campos preenchidos automaticamente a partir dos documentos.`
                      : "Extraia os dados dos documentos para preencher o formulário automaticamente."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={extractedFields.length > 0 ? "outline" : "default"}
                    disabled={extracting}
                    onClick={handleAutoFill}
                    className="shrink-0"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Analisando...
                      </>
                    ) : extractedFields.length > 0 ? (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Re-extrair
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Extrair dados automaticamente
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Quick actions tip */}
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Dica:</strong> Carregue a Invoice, o Packing List e o Certificado de Análise para o máximo de preenchimento automático. Os documentos ficam anexados ao dossiê após a criação.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Divider with hint */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou preencha manualmente</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Demo prefill */}
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => form.reset(DEMO_PREFILL)}>
            Preencher com exemplo (Tapada do Fidalgo)
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Identificação do processo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="internalNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Número do processo / Dossiê MAPA
                    {extractedFields.includes("internalNumber") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="I2400139612"
                      {...field}
                      className={extractedFields.includes("internalNumber") ? "border-status-success/50 bg-status-success/5 font-medium text-foreground" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="batchNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Lote (Certificado de Origem)
                    {extractedFields.includes("batchNumber") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="LVT25260101"
                      {...field}
                      className={extractedFields.includes("batchNumber") ? "border-status-success/50 bg-status-success/5 font-medium text-foreground" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="importerName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel className="flex items-center gap-1.5">
                    Importador
                    {extractedFields.includes("importerName") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={extractedFields.includes("importerName") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="exporterName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Exportador
                    {extractedFields.includes("exporterName") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={extractedFields.includes("exporterName") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="producerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Produtor / engarrafador
                    {extractedFields.includes("producerName") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={extractedFields.includes("producerName") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="countryOrigin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    País de origem
                    {extractedFields.includes("countryOrigin") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={extractedFields.includes("countryOrigin") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Produto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="productName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Produto (denominação)
                    {extractedFields.includes("productName") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vinho Fino Tinto Seco"
                      {...field}
                      className={extractedFields.includes("productName") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Marca
                    {extractedFields.includes("brand") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className={extractedFields.includes("brand") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vintage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Safra / ano
                    {extractedFields.includes("vintage") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="2025"
                      {...field}
                      className={extractedFields.includes("vintage") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="geographicalIndication"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Indicação geográfica
                    {extractedFields.includes("geographicalIndication") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Regional Alentejano"
                      {...field}
                      className={extractedFields.includes("geographicalIndication") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quantidade e volume</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="packageType"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel className="flex items-center gap-1.5">
                    Tipo de embalagem
                    {extractedFields.includes("packageType") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Caixas de 6 garrafas"
                      {...field}
                      className={extractedFields.includes("packageType") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="packageCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Número de embalagens
                    {extractedFields.includes("packageCount") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="800"
                      {...field}
                      className={extractedFields.includes("packageCount") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unitsPerPackage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Unidades por embalagem
                    {extractedFields.includes("unitsPerPackage") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="6"
                      {...field}
                      className={extractedFields.includes("unitsPerPackage") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unitCapacityLiters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Capacidade unitária (L)
                    {extractedFields.includes("unitCapacityLiters") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.75"
                      {...field}
                      className={extractedFields.includes("unitCapacityLiters") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="informedVolumeLiters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    Volume total informado (L)
                    {extractedFields.includes("informedVolumeLiters") && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 text-status-success border-status-success/30">
                        <Sparkles className="h-2.5 w-2.5" /> auto
                      </Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="3600"
                      {...field}
                      className={extractedFields.includes("informedVolumeLiters") ? "border-status-success/50 bg-status-success/5" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {calculatedVolume != null && (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Volume calculado a partir de embalagens × unidades × capacidade:{" "}
                <span className="font-medium text-foreground">{calculatedVolume.toLocaleString("pt-BR")} L</span>
                {form.getValues("informedVolumeLiters") &&
                  Number(form.getValues("informedVolumeLiters")) !== calculatedVolume && (
                    <span className="ml-2 text-severity-critical">— diverge do volume informado, será sinalizado na validação.</span>
                  )}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Criando…" : "Criar dossiê"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
