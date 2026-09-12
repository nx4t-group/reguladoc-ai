import { FileText, ShieldCheck, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/tenant";

import { MembersTable } from "./admin-client";

export default async function AdminPage() {
  const tenant = await requireRole(["admin"]);

  const [members, dossierCount, documentCount, activeRuleCount, globalSources, currentMembership] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: tenant.organizationId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dossier.count({ where: { organizationId: tenant.organizationId } }),
    prisma.document.count({ where: { organizationId: tenant.organizationId } }),
    prisma.validationRule.count({
      where: {
        status: "ativa",
        OR: [{ organizationId: tenant.organizationId }, { organizationId: null }],
      },
    }),
    prisma.regulatorySource.findMany({ where: { organizationId: null }, orderBy: { name: "asc" } }),
    prisma.organizationMember.findFirst({ where: { organizationId: tenant.organizationId, userId: tenant.userId } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Administração" description="Gestão de usuários, papéis e visão geral da organização." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-2xl font-semibold text-foreground">{dossierCount}</p>
              <p className="text-xs text-muted-foreground">Dossiês</p>
            </div>
            <FileText className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-2xl font-semibold text-foreground">{documentCount}</p>
              <p className="text-xs text-muted-foreground">Documentos</p>
            </div>
            <FileText className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-2xl font-semibold text-foreground">{activeRuleCount}</p>
              <p className="text-xs text-muted-foreground">Regras ativas (globais + organização)</p>
            </div>
            <ShieldCheck className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Usuários da organização</CardTitle>
              <CardDescription>Gerencie papéis e status de acesso dos usuários.</CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button variant="outline" disabled>
                    <Users className="h-4 w-4" />
                    Convidar usuário
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Convites por e-mail chegam na Fase 2</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            <MembersTable members={members} currentMembershipId={currentMembership?.id ?? ""} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fontes regulatórias globais</CardTitle>
          <CardDescription>Fontes de plataforma monitoradas para todas as organizações (somente leitura).</CardDescription>
        </CardHeader>
        <CardContent>
          {globalSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fonte global cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Autoridade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {globalSources.map((source) => (
                  <TableRow key={source.id}>
                    <TableCell>{source.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{source.authority}</TableCell>
                    <TableCell>
                      <Badge variant={source.status === "ativa" ? "success" : "neutral"}>
                        {source.status === "ativa" ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
