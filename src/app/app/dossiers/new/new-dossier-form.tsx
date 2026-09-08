"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { calculateTotalVolume } from "@/lib/rules/calculations";
import { createDossierAndRedirect, type CreateDossierInput } from "@/server/actions/dossiers";

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

const DEMO_PREFILL: FormValues = {
  internalNumber: "",
  importerName: "BARRINHAS Comércio e Importação de Bebidas e Cereais Ltda.",
  exporterName: "Granacer - Administração de Bens, S.A.",
  producerName: "Granacer - Administração de Bens, S.A.",
  countryOrigin: "Portugal",
  productName: "Vinho Fino Tinto Seco",
  brand: "Tapada do Fidalgo",
  vintage: "2025",
  geographicalIndication: "Regional Alentejano",
  batchNumber: "",
  packageType: "Caixas de 6 garrafas",
  packageCount: "800",
  unitsPerPackage: "6",
  unitCapacityLiters: "0.75",
  informedVolumeLiters: "3600",
};

export function NewDossierForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

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
      const result = await createDossierAndRedirect(payload);
      if (result && !result.ok) {
        toast.error(result.error ?? "Não foi possível criar o dossiê.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <FormLabel>Número interno do processo</FormLabel>
                  <FormControl>
                    <Input placeholder="DEMO-IMP-0003" {...field} />
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
                  <FormLabel>Lote (se já conhecido)</FormLabel>
                  <FormControl>
                    <Input placeholder="LVT25260101" {...field} />
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
                  <FormLabel>Importador</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Exportador</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Produtor / engarrafador</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>País de origem</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Produto (denominação)</FormLabel>
                  <FormControl>
                    <Input placeholder="Vinho Fino Tinto Seco" {...field} />
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
                  <FormLabel>Marca</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Safra / ano</FormLabel>
                  <FormControl>
                    <Input placeholder="2025" {...field} />
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
                  <FormLabel>Indicação geográfica</FormLabel>
                  <FormControl>
                    <Input placeholder="Regional Alentejano" {...field} />
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
                  <FormLabel>Tipo de embalagem</FormLabel>
                  <FormControl>
                    <Input placeholder="Caixas de 6 garrafas" {...field} />
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
                  <FormLabel>Número de embalagens</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="800" {...field} />
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
                  <FormLabel>Unidades por embalagem</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="6" {...field} />
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
                  <FormLabel>Capacidade unitária (L)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.75" {...field} />
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
                  <FormLabel>Volume total informado (L)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="3600" {...field} />
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
