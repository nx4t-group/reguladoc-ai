"use client";

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, FileCheck2, GitBranch, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { waitForSession } from "@/lib/auth-client";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  { email: "admin@demo.com", role: "Admin SaaS" },
  { email: "gestor@demo.com", role: "Gestor da Comissária" },
  { email: "analista@demo.com", role: "Analista Regulatório" },
];

export default function LoginPage() {
  const [loading, setLoading] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "analista@demo.com", password: "demo1234" },
  });

  async function onSubmit(values: LoginFormValues) {
    setLoading(true);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setLoading(false);

    if (!result || result.error) {
      toast.error("Credenciais inválidas. Verifique o e-mail e a senha.");
      return;
    }
    // Confirma que a sessão já está visível antes de navegar (evita um bounce
    // de volta para /login por causa de uma corrida com o cookie recém-emitido),
    // depois faz uma navegação completa para garantir que o cookie seja enviado.
    await waitForSession();
    window.location.assign("/painel");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">RegulaDoc AI</span>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Apoio à decisão para conformidade documental em importações reguladas.
          </h1>
          <p className="text-sm leading-relaxed text-sidebar-muted">
            Validação documental, motor de regras versionado, trilha de auditoria completa e monitor regulatório
            multi-fonte — com foco inicial em vinhos importados no Brasil.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3 text-sidebar-foreground/90">
              <FileCheck2 className="h-4 w-4 text-primary" /> Parecer de conformidade com evidências e score
            </li>
            <li className="flex items-center gap-3 text-sidebar-foreground/90">
              <GitBranch className="h-4 w-4 text-primary" /> Regras versionadas com trilha de auditoria completa
            </li>
            <li className="flex items-center gap-3 text-sidebar-foreground/90">
              <Lock className="h-4 w-4 text-primary" /> Isolamento multi-tenant e supervisão humana obrigatória
            </li>
          </ul>
        </div>

        <p className="text-xs text-sidebar-muted">
          Sistema de apoio à decisão — não substitui a análise do especialista humano.
        </p>
      </div>

      <div className="flex items-center justify-center bg-muted/30 px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center lg:hidden">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-lg font-semibold">RegulaDoc AI</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Entrar</CardTitle>
              <CardDescription>Acesse sua conta para continuar a análise regulatória.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando…" : "Entrar"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="border-dashed bg-muted/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Modo demonstração</CardTitle>
              <CardDescription>Use qualquer uma das contas abaixo com a senha <code className="rounded bg-muted px-1 py-0.5">demo1234</code>.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 pb-4">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    form.setValue("email", acc.email);
                    form.setValue("password", "demo1234");
                  }}
                  className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-xs hover:border-border hover:bg-background"
                >
                  <span className="font-medium">{acc.email}</span>
                  <span className="text-muted-foreground">{acc.role}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Nova organização?{" "}
            <Link href="/onboarding" className="font-medium text-primary hover:underline">
              Configurar agora
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
