import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DossierDetailData } from "./types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value ?? "—"}</p>
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
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm">Resumo do produto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Importador" value={dossier.importerName} />
          <Field label="Exportador" value={dossier.exporterName} />
          <Field label="Produtor / engarrafador" value={dossier.producerName} />
          <Field label="País de origem" value={dossier.countryOrigin} />
          <Field label="Produto" value={dossier.productName} />
          <Field label="Marca" value={dossier.brand} />
          <Field label="Safra" value={dossier.vintage} />
          <Field label="Indicação geográfica" value={dossier.geographicalIndication} />
          <Field label="Lote" value={dossier.batchNumber} />
          <Field label="Embalagem" value={dossier.packageType} />
          <Separator className="sm:col-span-2" />
          <Field label="Número de embalagens" value={dossier.packageCount} />
          <Field label="Unidades por embalagem" value={dossier.unitsPerPackage} />
          <Field label="Capacidade unitária" value={dossier.unitCapacityLiters ? `${dossier.unitCapacityLiters} L` : null} />
          <Field label="Volume informado" value={dossier.informedVolumeLiters ? `${dossier.informedVolumeLiters.toLocaleString("pt-BR")} L` : null} />
          <Field
            label="Volume calculado"
            value={
              dossier.calculatedVolumeLiters != null ? (
                <span className={dossier.informedVolumeLiters !== dossier.calculatedVolumeLiters ? "text-severity-critical" : undefined}>
                  {dossier.calculatedVolumeLiters.toLocaleString("pt-BR")} L
                </span>
              ) : null
            }
          />
          <Field label="Responsável" value={dossier.assignedTo?.name} />
          <Separator className="sm:col-span-2" />
          <Field label="Criado por" value={dossier.createdBy.name} />
          <Field label="Data de criação" value={format(new Date(dossier.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Checklist de documentos obrigatórios</CardTitle>
          </CardHeader>
          <CardContent>
            {missingRequiredDocuments.length === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Completo</AlertTitle>
                <AlertDescription>Todos os documentos obrigatórios foram enviados.</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Documentos pendentes</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {missingRequiredDocuments.map((d) => (
                      <li key={d.type}>{d.label}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
