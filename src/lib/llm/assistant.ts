import { scoreClassification } from "@/lib/constants";
import type { AlertSeverity } from "@/lib/constants";

export interface AssistantDossierSnapshot {
  internalNumber: string;
  productName: string;
  brand: string;
  status: string;
  complianceScore: number | null;
  documentsCount: number;
  missingDocumentLabels: string[];
  alerts: { title: string; severity: AlertSeverity; message: string; status: string }[];
}

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export const SUGGESTED_QUESTIONS = [
  "Quais documentos estão faltando?",
  "Quais inconsistências são críticas?",
  "O dossiê está apto para registro?",
  "Explique a divergência de marca.",
  "Quais regras foram aplicadas?",
];

/**
 * Camada de assistente de auditoria. Sem uma chave de LLM configurada
 * (`LLM_PROVIDER=mock`, o padrão do MVP), respostas são compostas de forma
 * determinística a partir dos dados reais do dossiê — nada é inventado, mas
 * também não há geração livre de texto. Preparado para, na Fase 2, virar uma
 * chamada real com RAG sobre os documentos do dossiê.
 */
export class LLMAssistantService {
  readonly isSimulated = (process.env.LLM_PROVIDER ?? "mock") === "mock";

  async ask(question: string, dossier: AssistantDossierSnapshot): Promise<string> {
    const q = question.toLowerCase();
    const critical = dossier.alerts.filter((a) => a.severity === "critica" && a.status !== "resolvido");
    const high = dossier.alerts.filter((a) => a.severity === "alta" && a.status !== "resolvido");

    if (q.includes("faltando") || q.includes("falta")) {
      if (dossier.missingDocumentLabels.length === 0) {
        return "Todos os documentos obrigatórios para este dossiê de vinho já foram enviados.";
      }
      return `Documentos obrigatórios ainda não enviados: ${dossier.missingDocumentLabels.join(", ")}.`;
    }

    if (q.includes("crítica") || q.includes("critica") || q.includes("críticos") || q.includes("criticos")) {
      if (critical.length === 0) return "Não há inconsistências críticas em aberto neste dossiê.";
      return `Foram identificadas ${critical.length} inconsistência(s) crítica(s): ${critical
        .map((a) => a.title)
        .join("; ")}. Todas exigem confirmação ou justificativa de um analista antes do registro.`;
    }

    if (q.includes("apto") || q.includes("registro")) {
      if (dossier.complianceScore == null) {
        return "A validação ainda não foi executada para este dossiê — não é possível avaliar aptidão para registro.";
      }
      const classification = scoreClassification(dossier.complianceScore);
      return `Score de conformidade atual: ${dossier.complianceScore}/100 (${classification.label}). Esta é uma recomendação do sistema de apoio à decisão — a aprovação final exige revisão humana registrada (RULE-014).`;
    }

    if (q.includes("marca")) {
      const brandAlert = dossier.alerts.find((a) => a.title.toLowerCase().includes("marca"));
      if (!brandAlert) return "Não há divergência de marca identificada entre os documentos deste dossiê.";
      return `${brandAlert.message} Recomenda-se revisão humana e conferência direta com o rótulo antes de confirmar ou rejeitar este alerta.`;
    }

    if (q.includes("regra") || q.includes("aplicada")) {
      const ruleTitles = Array.from(new Set(dossier.alerts.map((a) => a.title)));
      if (ruleTitles.length === 0) return "Nenhuma regra gerou alerta nesta última validação — o dossiê está limpo até o momento.";
      return `A validação mais recente aplicou o motor de regras completo (RULE-001 a RULE-015) e gerou alertas para: ${ruleTitles.join(", ")}.`;
    }

    return `Resumo do dossiê ${dossier.internalNumber} (${dossier.productName} — ${dossier.brand}): status "${dossier.status}", ${dossier.documentsCount} documento(s) anexado(s), ${dossier.alerts.length} alerta(s) no total (${critical.length} crítico(s), ${high.length} alto(s)). Pergunte sobre documentos faltantes, inconsistências críticas, aptidão para registro, divergência de marca ou regras aplicadas para mais detalhes.`;
  }

  async summarize(dossier: AssistantDossierSnapshot): Promise<string> {
    return this.ask("resumo", dossier);
  }
}

export const llmAssistant = new LLMAssistantService();
