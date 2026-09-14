"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileBarChart, PlayCircle, ThumbsDown, ThumbsUp, Trash2, Undo2 } from "lucide-react";

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
import { deleteDossier, requestCorrection } from "@/server/actions/dossiers";
import { runDossierValidation } from "@/server/actions/validation";

export function HeaderActions({
  dossierId,
  internalNumber,
  role,
  status,
  complianceScore,
  hasDocuments,
  hasValidated,
  hasReport,
}: {
  dossierId: string;
  internalNumber?: string;
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
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white/90 border border-stone-300 text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
          disabled={!hasDocuments || pending !== null}
          onClick={() => run("validate", () => runDossierValidation(dossierId))}
        >
          <PlayCircle className="h-3.5 w-3.5 text-stone-500" />
          <span>{pending === "validate" ? "Executando…" : hasValidated ? "Revalidar OCR & Regras" : "Executar validação"}</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white/90 border border-stone-300 text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
          disabled={complianceScore == null || pending !== null}
          onClick={() => run("report", () => generateReport(dossierId))}
        >
          <FileBarChart className="h-3.5 w-3.5 text-stone-500" />
          <span>{hasReport ? "Regenerar Relatório" : "Emitir Relatório"}</span>
        </button>

        {!isFinal && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-wine-50/80 border border-wine-600/30 text-wine-800 hover:bg-wine-100/90 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            disabled={pending !== null}
            onClick={() => run("correction", () => requestCorrection(dossierId))}
          >
            <Undo2 className="h-3.5 w-3.5 text-wine-700" />
            <span>Solicitar correção documental</span>
          </button>
        )}

        {canDecide && !isFinal && (
          <>
            <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-status-warning/40 text-status-warning hover:bg-status-warning/10" disabled={pending !== null}>
                <CheckCircle2 className="h-4 w-4" /> Liberar com ressalvas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Liberar com ressalvas documentais?</AlertDialogTitle>
                <AlertDialogDescription>
                  O dossiê será registrado como conferido com ressalvas técnicas. Esta recomendação operacional fica registrada na trilha de auditoria com seu usuário como revisor qualificado (RULE-014).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => run("approve-with-caveats", () => decideDossier({ dossierId, decision: "aprovado_com_ressalvas" }))}
                >
                  Confirmar decisão
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={pending !== null}>
                <ThumbsUp className="h-4 w-4" /> Liberar Pré-Embarque
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Recomendar liberação pré-embarque?</AlertDialogTitle>
                <AlertDialogDescription>
                  Confirma a conclusão da conferência documental sem bloqueios impeditivos? Inconformidades críticas ou altas em aberto impedem a liberação.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("approve", () => decideDossier({ dossierId, decision: "aprovado" }))}>
                  Confirmar liberação
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={pending !== null}>
                <ThumbsDown className="h-4 w-4" /> Bloquear Liberação
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bloquear liberação pré-embarque?</AlertDialogTitle>
                <AlertDialogDescription>
                  O dossiê será marcado como bloqueado por inconformidades documentais. Esta decisão fica registrada na trilha de auditoria imutável.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("reject", () => decideDossier({ dossierId, decision: "reprovado" }))}>
                  Confirmar bloqueio
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {canDecide && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                disabled={pending !== null}
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                <span>Excluir Dossiê</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-rose-950 flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-rose-600" />
                  Excluir Dossiê {internalNumber ? `"${internalNumber}"` : ""}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação executará a exclusão lógica (soft-delete) do dossiê no sistema. O processo será removido de todas as listagens operacionais, preservando o registro na trilha de auditoria para conformidade regulatória.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                  onClick={async () => {
                    setPending("delete");
                    try {
                      const res = await deleteDossier(dossierId);
                      if (!res.ok) {
                        toast.error(res.error ?? "Não foi possível excluir o dossiê.");
                        return;
                      }
                      toast.success("Dossiê excluído com sucesso.");
                      router.push("/painel/dossiers");
                    } finally {
                      setPending(null);
                    }
                  }}
                >
                  Confirmar Exclusão
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
