import { Info } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PLANS, PLAN_LABELS, type Plan } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

import { OrganizationForm } from "./organization-form";

export default async function SettingsPage() {
  const tenant = await requireTenant();
  const organization = await prisma.organization.findUnique({ where: { id: tenant.organizationId } });

  if (!organization) {
    return (
      <div>
        <PageHeader title="Configurações" />
        <p className="text-sm text-muted-foreground">Organização não encontrada.</p>
      </div>
    );
  }

  const currentPlan = (organization.plan as Plan) ?? "starter";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Dados cadastrais, plano de assinatura e políticas de retenção da organização."
      />

      <Card>
        <CardHeader>
          <CardTitle>Dados da organização</CardTitle>
          <CardDescription>Informações cadastrais e política de retenção de documentos.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm
            organization={{ name: organization.name, cnpj: organization.cnpj, retentionDays: organization.retentionDays }}
            readOnly={tenant.role === "analista"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plano</CardTitle>
          <CardDescription>Plano atual da organização e limites de uso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan}
                className={cn(
                  "rounded-lg border p-4",
                  plan === currentPlan ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{PLAN_LABELS[plan]}</p>
                  {plan === currentPlan && <Badge>Atual</Badge>}
                </div>
              </div>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button variant="outline" disabled>
                  Alterar plano
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Billing disponível na Fase 2</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retenção e LGPD</CardTitle>
          <CardDescription>Política de guarda e descarte de documentos do dossiê.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como os dados desta organização são tratados</AlertTitle>
            <AlertDescription>
              Documentos e campos extraídos são retidos por {organization.retentionDays} dias. Após esse prazo, os
              registros são marcados para exclusão lógica (soft-delete via campo <code>deletedAt</code>) e deixam de ser
              exibidos na aplicação. Nenhum dado do dossiê é enviado a provedores de IA externos sem configuração
              explícita — a extração documental e a geração de pareceres deste MVP operam em modo simulado (mock), como
              detalhado na tela de Segurança e Governança.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
