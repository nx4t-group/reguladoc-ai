import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { scoreClassification } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

export default async function ReportsPage() {
  const tenant = await requireTenant();

  const reports = await prisma.report.findMany({
    where: { organizationId: tenant.organizationId },
    include: { dossier: { select: { id: true, internalNumber: true, complianceScore: true } }, generatedBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
    orderBy: { generatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Pareceres de conformidade emitidos para os dossiês da sua organização." />

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <FileBarChart className="h-8 w-8" />
            <p className="text-sm">Nenhum parecer gerado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Emitido por</TableHead>
                <TableHead>Aprovado por</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const classification = report.dossier.complianceScore != null ? scoreClassification(report.dossier.complianceScore) : null;
                return (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Link href={`/painel/dossiers/${report.dossier.id}`} className="font-medium hover:underline">
                        {report.title}
                      </Link>
                    </TableCell>
                    <TableCell>{report.dossier.complianceScore ?? "—"}/100</TableCell>
                    <TableCell>
                      {classification && (
                        <Badge variant={classification.tone === "destructive" ? "destructive" : classification.tone === "success" ? "success" : "warning"}>
                          {classification.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{report.generatedBy.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{report.approvedBy?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(report.generatedAt, "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
