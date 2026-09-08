import {
  CheckCircle2,
  FileBarChart,
  FilePlus2,
  FileSearch,
  History,
  PlayCircle,
  ShieldAlert,
  Tag,
  ThumbsDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditEventData } from "./types";

const ACTION_ICON: Record<string, typeof History> = {
  dossie_criado: FilePlus2,
  dossie_atualizado: History,
  status_alterado: History,
  documento_enviado: FilePlus2,
  tipo_documental_alterado: Tag,
  extracao_executada: FileSearch,
  validacao_executada: PlayCircle,
  alerta_gerado: ShieldAlert,
  alerta_revisado: CheckCircle2,
  regra_alterada: Tag,
  parecer_gerado: FileBarChart,
  usuario_aprovou: CheckCircle2,
  usuario_rejeitou: ThumbsDown,
  relatorio_emitido: FileBarChart,
};

const ACTION_LABEL: Record<string, string> = {
  dossie_criado: "Dossiê criado",
  dossie_atualizado: "Dossiê atualizado",
  status_alterado: "Status alterado",
  documento_enviado: "Documento enviado",
  tipo_documental_alterado: "Tipo documental alterado",
  extracao_executada: "Extração executada",
  validacao_executada: "Validação executada",
  alerta_gerado: "Alerta gerado",
  alerta_revisado: "Alerta revisado",
  regra_alterada: "Regra alterada",
  parecer_gerado: "Parecer gerado",
  usuario_aprovou: "Dossiê aprovado",
  usuario_rejeitou: "Dossiê reprovado",
  relatorio_emitido: "Relatório emitido",
};

export function AuditTab({ events }: { events: AuditEventData[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum evento registrado ainda.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Trilha de auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-6 border-l border-border pl-6">
          {events.map((event) => {
            const Icon = ACTION_ICON[event.action] ?? History;
            return (
              <li key={event.id} className="relative">
                <span className="absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-medium">{ACTION_LABEL[event.action] ?? event.action}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(event.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <p className="text-xs text-muted-foreground">por {event.userName}</p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
