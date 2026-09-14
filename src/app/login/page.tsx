"use client";

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileCheck2,
  GitBranch,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

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
  const [activeAccount, setActiveAccount] = React.useState<string>("analista@demo.com");

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

    await waitForSession();
    window.location.assign("/painel");
  }

  function fillCredentials(email: string) {
    setActiveAccount(email);
    form.setValue("email", email, { shouldDirty: true });
    form.setValue("password", "demo1234", { shouldDirty: true });
  }

  return (
    <main className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-brand-cream selection:bg-brand-green selection:text-white font-sans text-slate-800 antialiased">
      {/* ── LEFT HERO SECTION (BRAND STORYTELLING) ── */}
      <section className="lg:w-7/12 relative flex flex-col justify-between p-8 sm:p-12 lg:p-16 xl:p-20 bg-soft-gradient border-b lg:border-b-0 lg:border-r border-slate-200/80 overflow-hidden">
        {/* Background Decorative Graphic Elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-green-50/70 rounded-full blur-2xl pointer-events-none -z-10" />

        {/* Top Header / Brand */}
        <div className="flex items-center space-x-3 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold tracking-tight text-brand-navy">RegulaDoc</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-navy text-emerald-400">AI</span>
            </div>
            <p className="text-xs text-slate-500 font-medium tracking-wide mt-0.5">Validação Regulatória &amp; Governança</p>
          </div>
        </div>

        {/* Center Content & Value Proposition */}
        <div className="my-10 lg:my-auto max-w-xl z-10">
          {/* Sector Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/70 border border-emerald-300/60 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-xs font-bold tracking-wide uppercase text-emerald-900">
              Importação de Bebidas &amp; Vinhos
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight text-brand-navy leading-[1.18]">
            Apoio à decisão para <br className="hidden sm:inline" />
            <span className="text-brand-green">conformidade documental</span> <br className="hidden sm:inline" />
            em importações reguladas.
          </h1>

          {/* Subheading */}
          <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            Validação documental ponta a ponta, motor de regras versionado, trilha de auditoria completa e monitor regulatório multi-fonte — com precisão cirúrgica em vinhos importados no Brasil.
          </p>

          {/* Feature Bullets */}
          <div className="mt-8 space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-md bg-emerald-100/90 text-emerald-800 flex items-center justify-center border border-emerald-300/40">
                <FileCheck2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-sm sm:text-base text-slate-700 font-medium">
                Parecer de conformidade com evidências e score automatizado
              </span>
            </div>

            <div className="flex items-start space-x-3.5">
              <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-md bg-emerald-100/90 text-emerald-800 flex items-center justify-center border border-emerald-300/40">
                <GitBranch className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-sm sm:text-base text-slate-700 font-medium">
                Regras versionadas com trilha de auditoria completa e rastreabilidade
              </span>
            </div>

            <div className="flex items-start space-x-3.5">
              <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-md bg-emerald-100/90 text-emerald-800 flex items-center justify-center border border-emerald-300/40">
                <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-sm sm:text-base text-slate-700 font-medium">
                Isolamento multi-tenant de dados e supervisão humana obrigatória
              </span>
            </div>
          </div>

          {/* Wine Sector Inspiration Badge */}
          <div className="mt-10 p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-emerald-100 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-xl flex-shrink-0">
              🍇
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-brand-green">
                Especialidade Vitivinícola
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Integrado com padrões MAPA, análise de certificados analíticos, contrarrótulos e dossiês de desembaraço.
              </p>
            </div>
          </div>
        </div>

        {/* Legal Disclaimer Footer */}
        <div className="pt-6 border-t border-slate-200/80 z-10">
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            Sistema de apoio à decisão — não substitui a análise do especialista humano.
          </p>
        </div>
      </section>

      {/* ── RIGHT AUTH SECTION (LOGIN CARD) ── */}
      <section className="lg:w-5/12 flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-[#FAF9F6]">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl p-7 sm:p-9 border border-slate-200/90 custom-shadow">
            {/* Header */}
            <div className="flex items-center space-x-3.5 mb-7">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-brand-green">
                <Lock className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-brand-navy">Acessar Painel</h2>
                <p className="text-xs text-slate-500 font-medium">RegulaDoc AI — Validação Regulatória</p>
              </div>
            </div>

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                        E-mail corporativo
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="analista@demo.com"
                          className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/70 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-brand-green transition duration-150 ease-in-out placeholder:text-slate-400"
                          {...field}
                        />
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
                      <div className="flex items-center justify-between mb-1.5">
                        <FormLabel className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Senha
                        </FormLabel>
                        <span className="text-xs text-brand-green hover:text-brand-greenHover font-semibold transition cursor-pointer">
                          Esqueceu?
                        </span>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/70 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-brand-green transition duration-150 ease-in-out placeholder:text-slate-400"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Remember Checkbox */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      defaultChecked
                      type="checkbox"
                      className="w-4 h-4 rounded text-brand-green border-slate-300 focus:ring-brand-green accent-brand-green"
                    />
                    <span className="text-xs text-slate-600 font-medium">Lembrar sessão segura</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 bg-brand-green hover:bg-brand-greenHover disabled:opacity-70 text-white font-semibold text-sm rounded-lg shadow-md shadow-emerald-800/15 hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      <span>Entrando no Sistema…</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </Form>

            {/* Demo Credentials Box */}
            <div className="mt-7 pt-5 border-t border-dashed border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Modo demonstração</span>
                <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold tracking-tight">
                  demo1234
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Clique em uma das credenciais para carregar o perfil de teste:
              </p>

              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = activeAccount === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => fillCredentials(acc.email)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border transition text-left cursor-pointer ${
                        isSelected
                          ? "bg-emerald-50/80 border-emerald-300/80 shadow-xs"
                          : "bg-slate-50 hover:bg-emerald-50/70 border-slate-200/80 hover:border-emerald-300/60"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isSelected ? "bg-emerald-500 ring-2 ring-emerald-300" : "bg-slate-400"
                          }`}
                        />
                        <span className={`text-xs font-medium ${isSelected ? "text-brand-navy font-semibold" : "text-slate-700"}`}>
                          {acc.email}
                        </span>
                      </div>
                      <span className={`text-[11px] font-semibold ${isSelected ? "text-brand-green" : "text-slate-500"}`}>
                        {acc.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer inside card */}
            <div className="mt-6 text-center text-xs text-slate-500">
              Nova organização?{" "}
              <Link href="/onboarding" className="font-bold text-brand-navy hover:text-brand-green hover:underline ml-1">
                Configurar agora
              </Link>
            </div>
          </div>

          {/* Security badges below card */}
          <div className="mt-6 flex items-center justify-center space-x-6 text-xs text-slate-500">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Criptografia 256-bit</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>LGPD Compliance</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
