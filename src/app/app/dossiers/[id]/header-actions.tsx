"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileBarChart, PlayCircle, ThumbsDown, ThumbsUp, Undo2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/constants";
import { decideDossier, generateReport } from "@/server/actions/reports";
import { requestCorrection } from "@/server/actions/dossiers";
import { runDossierValidation } from "@/server/actions/validation";

export function HeaderActions({
  dossierId,
  role,
  status,
  complianceScore,
  hasDocuments,
  hasValidated,
  hasReport,
}: {
  dossierId: string;
  role: Role;
  status: string;
  complianceScore: number | null;
  hasDocuments: boolean;
  hasValidated: boolean;
  hasReport: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const canDecide = role === "admin" || role === "gestor";
  const isFinal = ["aprovado", "aprovado_com_ressalvas", "reprovado", "arquivado"].includes(status);

  async function run(action: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(action);
    try {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível concluir a ação.");
        return;
      }
      toast.success("Ação concluída.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasDocuments || pending !== null}
          onClick={() => run("validate", () => runDossierValidation(dossierId))}
        >
          <PlayCircle className="h-4 w-4" />
          {pending === "validate" ? "Executando…" : hasValidated ? "Revalidar" : "Executar validação"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={complianceScore == null || pending !== null}
          onClick={() => run("report", () => generateReport(dossierId))}
        >
          <FileBarChart className="h-4 w-4" /> {hasReport ? "Regerar parecer" : "Gerar parecer"}
        </Button>

        {!isFinal && (
          <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => run("correction", () => requestCorrection(dossierId))}>
            <Undo2 className="h-4 w-4" /> Solicitar correção
          </Button>
        )}

        {canDecide && !isFinal && (
          <>
            <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-status-warning/40 text-status-warning hover:bg-status-warning/10" disabled={pending !== null}>
                <CheckCircle2 className="h-4 w-4" /> Aprovar com ressalvas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Aprovar com ressalvas?</AlertDialogTitle>
                <AlertDialogDescription>
                  O dossiê será marcado como aprovado com ressalvas. Esta decisão fica registrada na trilha de auditoria com seu usuário como revisor (RULE-014).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => run("approve-with-caveats", () => decideDossier({ dossierId, decision: "aprovado_com_ressalvas" }))}
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={pending !== null}>
                <ThumbsUp className="h-4 w-4" /> Aprovar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Aprovar dossiê?</AlertDialogTitle>
                <AlertDialogDescription>
                  Confirma a aprovação final deste dossiê como revisor humano? Alertas críticos em aberto impedem a aprovação.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("approve", () => decideDossier({ dossierId, decision: "aprovado" }))}>
                  Confirmar aprovação
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={pending !== null}>
                <ThumbsDown className="h-4 w-4" /> Reprovar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reprovar dossiê?</AlertDialogTitle>
                <AlertDialogDescription>Esta decisão fica registrada na trilha de auditoria e pode ser revertida apenas criando uma nova revisão.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("reject", () => decideDossier({ dossierId, decision: "reprovado" }))}>
                  Confirmar reprovação
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
