import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { isExtractionSimulated } from "@/lib/extraction/service";

export default async function SecurityPage() {
  const tenant = await requireTenant();

  const auditEventCount = await prisma.auditEvent.count({ where: { organizationId: tenant.organizationId } });
  const organization = await prisma.organization.findUnique({ where: { id: tenant.organizationId } });

  const simulated = isExtractionSimulated();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const llmProvider = process.env.LLM_PROVIDER ?? "mock";

  return (
    <div className="space-y-6">
      <PageHeader title="Segurança e Governança" description="Como o isolamento entre organizações, a retenção de dados e a supervisão humana são garantidos neste MVP." />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Isolamento multi-tenant</CardTitle>
              <CardDescription>Como os dados de cada organização são mantidos separados.</CardDescription>
            </div>
            <Badge variant="warning">Modo: desenvolvimento local</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Este MVP roda sobre SQLite, que não possui Row Level Security (RLS) nativo como o Postgres. Por isso, o
            isolamento entre organizações é implementado como uma <strong className="text-foreground">&quot;RLS aplicativa&quot;</strong>:
            toda página e toda server action resolvem a sessão autenticada via <code>requireTenant()</code> ou{" "}
            <code>requireRole()</code> (em <code>src/lib/tenant.ts</code>) antes de qualquer acesso a dado, e todo{" "}
            <code>where</code>/<code>data</code> de consulta ou mutação Prisma é explicitamente filtrado por{" "}
            <code>organizationId</code>.
          </p>
          <p>
            Nenhuma consulta confia em um <code>organizationId</code> enviado pelo cliente — o valor sempre vem da
            sessão JWT resolvida no servidor.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retenção de documentos</CardTitle>
          <CardDescription>Prazo de guarda configurado para esta organização.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Documentos e campos extraídos desta organização são retidos por{" "}
            <strong className="text-foreground">{organization?.retentionDays ?? 1825} dias</strong>. Após esse prazo,
            os registros são marcados para exclusão lógica através do campo <code>deletedAt</code> — o dado não é
            removido fisicamente de imediato, mas deixa de ser exibido na aplicação. O prazo pode ser ajustado na tela
            de Configurações por usuários admin/gestor.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provedores de IA configurados</CardTitle>
          <CardDescription>Extração documental e geração de pareceres/resumos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="font-medium text-foreground">Extração de documentos (OCR)</p>
              <p className="text-xs text-muted-foreground">Status: {simulated ? "Simulado (mock)" : "Real (Google Gemini 1.5 Flash)"}</p>
            </div>
            <Badge variant={simulated ? "warning" : "success"}>
              {simulated ? "Modo simulado" : "Gemini OCR Ativo"}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="font-medium text-foreground">Chave de API do Gemini (GEMINI_API_KEY)</p>
              <p className="text-xs text-muted-foreground">Configuração no ambiente (.env)</p>
            </div>
            <Badge variant={hasGeminiKey ? "success" : "neutral"}>
              {hasGeminiKey ? "Configurada" : "Ausente"}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="font-medium text-foreground">Modelo de linguagem (LLM)</p>
              <p className="text-xs text-muted-foreground">Variável de ambiente: LLM_PROVIDER</p>
            </div>
            <Badge variant={llmProvider === "mock" ? "warning" : "success"}>
              {llmProvider === "mock" ? "Modo simulado" : "Configurado"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {simulated 
              ? "Em modo simulado, nenhum documento ou campo extraído é enviado a uma API de IA externa: a extração e as avaliações usam adaptadores locais simulados."
              : "Com o Gemini OCR configurado, os PDFs e imagens enviados são processados pela API multimodal do Google Gemini, extraindo os dados estruturados de forma real."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supervisão humana obrigatória</CardTitle>
          <CardDescription>Nenhuma aprovação final é automática.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="warning">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>RULE-014 — Validação humana obrigatória</AlertTitle>
            <AlertDescription>
              Nenhum dossiê pode ser marcado como &quot;Aprovado&quot; apenas com base na avaliação da IA. A aprovação final
              exige um usuário revisor identificado e uma data de aprovação registrada — o motor de regras apenas
              organiza e prioriza achados para apoiar a decisão humana.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Trilha de auditoria</CardTitle>
              <CardDescription>Eventos registrados para esta organização.</CardDescription>
            </div>
            <ShieldCheck className="h-5 w-5 text-status-success" />
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold text-foreground">{auditEventCount}</p>
            <p className="text-xs text-muted-foreground">eventos de auditoria registrados até o momento</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/app/dossiers">Ver auditoria por dossiê</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
