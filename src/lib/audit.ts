import { prisma } from "@/lib/prisma";

export interface LogAuditEventInput {
  organizationId: string;
  userId?: string | null;
  dossierId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

/**
 * Registra um evento na trilha de auditoria (seção 7.9 do escopo). Chamado a
 * partir de todas as server actions que criam, alteram ou avaliam entidades
 * do domínio.
 */
export async function logAuditEvent(input: LogAuditEventInput) {
  await prisma.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      dossierId: input.dossierId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.before !== undefined ? JSON.stringify(input.before) : null,
      afterJson: input.after !== undefined ? JSON.stringify(input.after) : null,
      metadataJson: input.metadata !== undefined ? JSON.stringify(input.metadata) : null,
    },
  });
}

export const AUDIT_ACTIONS = {
  DOSSIER_CREATED: "dossie_criado",
  DOSSIER_UPDATED: "dossie_atualizado",
  DOSSIER_STATUS_CHANGED: "status_alterado",
  DOCUMENT_UPLOADED: "documento_enviado",
  DOCUMENT_TYPE_CHANGED: "tipo_documental_alterado",
  DOCUMENT_EXTRACTED: "extracao_executada",
  VALIDATION_RUN: "validacao_executada",
  ALERT_GENERATED: "alerta_gerado",
  ALERT_REVIEWED: "alerta_revisado",
  RULE_CHANGED: "regra_alterada",
  REPORT_GENERATED: "parecer_gerado",
  DOSSIER_APPROVED: "usuario_aprovou",
  DOSSIER_REJECTED: "usuario_rejeitou",
  REPORT_ISSUED: "relatorio_emitido",
  REGULATORY_ITEM_CONVERTED: "item_regulatorio_convertido_em_regra",
} as const;
