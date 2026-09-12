"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { updateOrganizationSettings } from "@/server/actions/settings";

const organizationFormSchema = z.object({
  name: z.string().min(2, "Informe o nome da organização."),
  cnpj: z.string().optional(),
  retentionDays: z.coerce.number().int().min(30, "Mínimo de 30 dias.").max(3650, "Máximo de 3650 dias."),
});
type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export function OrganizationForm({
  organization,
  readOnly,
}: {
  organization: { name: string; cnpj: string | null; retentionDays: number };
  readOnly: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: organization.name,
      cnpj: organization.cnpj ?? "",
      retentionDays: organization.retentionDays,
    },
  });

  function onSubmit(values: OrganizationFormValues) {
    startTransition(async () => {
      const result = await updateOrganizationSettings(values);
      if (result.success) {
        toast.success("Configurações da organização atualizadas.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da organização</FormLabel>
              <FormControl>
                <Input disabled={readOnly} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cnpj"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CNPJ</FormLabel>
              <FormControl>
                <Input disabled={readOnly} placeholder="00.000.000/0000-00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="retentionDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Retenção de documentos (dias)</FormLabel>
              <FormControl>
                <Input type="number" disabled={readOnly} {...field} />
              </FormControl>
              <FormDescription>
                Padrão: 1825 dias (5 anos), conforme prazo usual de guarda de documentação aduaneira.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {readOnly ? (
          <p className="text-xs text-muted-foreground">
            Seu papel (Analista Regulatório) tem acesso somente leitura a estas configurações.
          </p>
        ) : (
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        )}
      </form>
    </Form>
  );
}
