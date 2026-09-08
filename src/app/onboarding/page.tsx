"use client";

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { waitForSession } from "@/lib/auth-client";
import { registerOrganization } from "@/server/actions/auth";

const onboardingSchema = z.object({
  organizationName: z.string().min(2, "Informe o nome da organização."),
  cnpj: z.string().optional(),
  userName: z.string().min(2, "Informe seu nome."),
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { organizationName: "", cnpj: "", userName: "", email: "", password: "" },
  });

  async function onSubmit(values: OnboardingFormValues) {
    setLoading(true);
    try {
      const result = await registerOrganization(values);
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível criar a organização.");
        return;
      }
      const signInResult = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (!signInResult || signInResult.error) {
        toast.error("Organização criada, mas não foi possível entrar automaticamente. Faça login.");
        window.location.assign("/login");
        return;
      }
      toast.success("Organização criada com sucesso.");
      await waitForSession();
      window.location.assign("/app");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5.5 w-5.5" />
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">Configurar nova organização</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie sua comissária/despachante no RegulaDoc AI. Você será o administrador inicial.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Dados da organização
            </CardTitle>
            <CardDescription>Usados nos cabeçalhos de relatórios e na trilha de auditoria.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da organização</FormLabel>
                      <FormControl>
                        <Input placeholder="Comissária Brasil Ltda." {...field} />
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
                      <FormLabel>CNPJ (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="00.000.000/0001-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                <p className="text-sm font-medium">Sua conta de administrador</p>

                <FormField
                  control={form.control}
                  name="userName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seu nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Maria Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="voce@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 8 caracteres" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando organização…" : "Criar organização e continuar"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
