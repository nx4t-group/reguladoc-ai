"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Layers, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { startFinalReview } from "@/server/actions/dossiers";
import type { DossierDetailData } from "./types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

export function OverviewTab({
  dossier,
  missingRequiredDocuments,
}: {
  dossier: DossierDetailData;
  missingRequiredDocuments: { type: string; label: string }[];
}) {
  const [loadingAction, setLoadingAction] = React.useState(false);

  const isAwaitingDocs =
    dossier.status === "AWAITING_DOCUMENTS" ||
    dossier.status === "documentos_pendentes" ||
    dossier.status === "DRAFT";

  async function handleStartFinalReview() {
    setLoadingAction(true);
    try {
      const res = await startFinalReview(dossier.id);
      if (res.ok) {
        toast.success("Conferência final iniciada! O dossiê agora está pronto para revisão.");
      } else {
        toast.error(res.error ?? "Erro ao iniciar conferência.");
      }
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* RESUMO DO PROCESSO */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Resumo do Processo & Embarque</CardTitle>
            <CardDescription className="text-xs">Dados cadastrais informados do dossiê de importação.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Importador" value={dossier.importerName} />
            <Field label="Exportador" value={dossier.exporterName} />
            <Field label="Produtor / Engarrafador" value={dossier.producerName} />
            <Field label="País de Origem" value={dossier.countryOrigin} />
            <Field label="Produto Principal" value={dossier.productName} />
            <Field label="Marca" value={dossier.brand} />
            <Field label="Safra" value={dossier.vintage} />
            <Field label="Indicação Geográfica" value={dossier.geographicalIndication} />
            <Field label="Lote Principal" value={dossier.batchNumber} />
            <Field label="Tipo de Embalagem" value={dossier.packageType} />
            <Separator className="sm:col-span-2" />
            <Field label="Quantidade de Embalagens" value={dossier.packageCount} />
            <Field label="Unidades por Embalagem" value={dossier.unitsPerPackage} />
            <Field
              label="Capacidade Unitária"
              value={dossier.unitCapacityLiters ? `${dossier.unitCapacityLiters} L` : null}
            />
            <Field
              label="Volume Total Informado"
              value={
                dossier.informedVolumeLiters
                  ? `${dossier.informedVolumeLiters.toLocaleString("pt-BR")} L`
                  : null
              }
            />
            <Field
              label="Volume Calculado"
              value={
                dossier.calculatedVolumeLiters != null ? (
                  <span
                    className={
                      dossier.informedVolumeLiters !== dossier.calculatedVolumeLiters
                        ? "text-severity-critical font-semibold"
                        : undefined
                    }
                  >
                    {dossier.calculatedVolumeLiters.toLocaleString("pt-BR")} L
                  </span>
                ) : null
              }
            />
            <Field label="Responsável" value={dossier.assignedTo?.name} />
            <Separator className="sm:col-span-2" />
            <Field label="Criado por" value={dossier.createdBy.name} />
            <Field
              label="Data de Criação"
              value={format(new Date(dossier.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            />
          </CardContent>
        </Card>

        {/* ENTIDADE DOSSIER ITEM (MÚLTIPLOS ITENS) */}
        {dossier.items && dossier.items.length > 0 && (
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" /> Itens do Processo ({dossier.items.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Rótulos, marcas e lotes que compõem este embarque.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {dossier.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/80 bg-muted/20 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Item #{item.itemNumber} · {item.brand} ({item.productName})
                    </span>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      Lote: {item.batchNumber ?? "—"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-muted-foreground pt-1">
                    <span>Safra: {item.vintage ?? "N/D"}</span>
                    <span>Embalagens: {item.packageCount ?? "—"}</span>
                    <span>Volume Total: {item.totalVolumeLiters ? `${item.totalVolumeLiters} L` : "—"}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* COLUNA LATERAL: CHECKLIST DOCUMENTAL & LIFECYCLE */}
      <div className="space-y-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Checklist Documental Obrigatório</CardTitle>
            <CardDescription className="text-xs">
              Conferência pré-embarque conforme Instruções Normativas do MAPA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {missingRequiredDocuments.length === 0 ? (
              <div className="space-y-3">
                <Alert className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertTitle className="text-emerald-800 dark:text-emerald-300 font-semibold">
                    Documentação Completa
                  </AlertTitle>
                  <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-400">
                    Todos os 6 documentos essenciais para vinhos foram anexados.
                  </AlertDescription>
                </Alert>

                {isAwaitingDocs && (
                  <Button
                    className="w-full text-xs font-semibold gap-1.5"
                    onClick={handleStartFinalReview}
                    disabled={loadingAction}
                  >
                    Documentação completa — iniciar conferência final
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Alert className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800 dark:text-amber-300 font-semibold">
                    {isAwaitingDocs ? "Pendência Documental" : "Documentos Obrigatórios Ausentes"}
                  </AlertTitle>
                  <AlertDescription className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    {isAwaitingDocs ? (
                      <p>
                        Aguardando instrução. A ausência de documentos nesta fase de coleta é tratada como{" "}
                        <strong>pendência documental</strong> e não constitui inconformidade regulatória até a
                        conferência final.
                      </p>
                    ) : (
                      <p>Estes documentos não foram localizados para a conferência final:</p>
                    )}
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      {missingRequiredDocuments.map((d) => (
                        <li key={d.type} className="font-medium">
                          {d.label}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>

                <p className="text-[11px] text-muted-foreground">
                  Acesse a aba <strong>Documentos</strong> para fazer upload dos arquivos faltantes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GOVERNANÇA REGULATÓRIA */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs space-y-1.5 text-muted-foreground">
          <p className="font-semibold text-foreground">Regulação MAPA Aplicável</p>
          <p>
            Vinhos e derivados da uva importados para o Brasil estão sujeitos ao Anexo IX (Certificado de Origem e
            Análise), Instrução Normativa MAPA nº 67/2018 e Decreto nº 8.198/2014.
          </p>
        </div>
      </div>
    </div>
  );
}
