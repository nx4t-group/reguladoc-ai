"use server";

import { revalidatePath } from "next/cache";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import type { AlertSeverity, RegulatoryPublicationType, RuleCategory } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

type ActionResult<T = Record<string, unknown>> = ({ success: true } & T) | { success: false; error: string };

export interface AddManualRegulatorySourceInput {
  name: string;
  url: string;
  authority: string;
}

export async function addManualRegulatorySource(
  input: AddManualRegulatorySourceInput,
): Promise<ActionResult<{ sourceId: string }>> {
  const tenant = await requireTenant();

  const source = await prisma.regulatorySource.create({
    data: {
      organizationId: tenant.organizationId,
      name: input.name,
      url: input.url,
      authority: input.authority,
      sourceType: "manual",
      checkFrequency: "manual",
      status: "ativa",
    },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    action: "fonte_regulatoria_adicionada",
    entityType: "regulatory_source",
    entityId: source.id,
    after: { name: source.name, url: source.url, authority: source.authority },
  });

  revalidatePath("/app/regulatory-monitor");
  return { success: true, sourceId: source.id };
}

/**
 * Modelos plausíveis de publicações regulatórias sobre importação de vinho,
 * usados para simular achados de uma verificação de fonte (MAPA/Receita
 * Federal/Anvisa-style). Nenhuma chamada externa real é feita neste MVP.
 */
const SIMULATED_ITEM_TEMPLATES: Array<{
  title: string;
  authority: string;
  publicationType: RegulatoryPublicationType;
  summary: string;
  aiImpact: string;
}> = [
  {
    title: "Instrução Normativa atualiza parâmetros físico-químicos exigidos para vinhos importados",
    authority: "MAPA",
    publicationType: "instrucao_normativa",
    summary:
      "Novo ato normativo revisa os limites de acidez volátil, metanol e teor alcoólico mínimo exigidos em laudos de análise para vinhos importados.",
    aiImpact:
      "Impacto potencial sobre a regra de parâmetros laboratoriais (RULE-010). Recomenda-se revisão manual dos limites antes de qualquer alteração de regra.",
  },
  {
    title: "Resolução estabelece novos critérios de rastreabilidade de lote para bebidas importadas",
    authority: "MAPA",
    publicationType: "resolucao",
    summary:
      "A resolução reforça a exigência de que o número de lote conste de forma idêntica em todos os documentos que acompanham o processo de importação.",
    aiImpact:
      "Reforça diretamente as regras de presença e consistência de lote (RULE-001/RULE-002). Nenhuma alteração de regra necessária — apenas atualizar a referência normativa.",
  },
  {
    title: "Portaria conjunta MAPA/Receita Federal sobre conferência documental prévia ao registro de DI",
    authority: "Receita Federal / MAPA",
    publicationType: "portaria",
    summary:
      "Estabelece checklist documental obrigatório (Anexo IX, certificado de origem, laudo de análise) prévio ao registro da Declaração de Importação de bebidas.",
    aiImpact:
      "Relacionado à regra de documentação obrigatória (RULE-013). Sugere-se validar se todos os tipos documentais já estão cobertos pelo catálogo de regras.",
  },
  {
    title: "Instrução Normativa disciplina o registro de indicações geográficas estrangeiras reconhecidas no Brasil",
    authority: "MAPA",
    publicationType: "instrucao_normativa",
    summary:
      "Atualiza a lista de indicações geográficas estrangeiras com reconhecimento automático no território nacional, incluindo denominações vitivinícolas europeias.",
    aiImpact:
      "Pode impactar a regra de consistência de indicação geográfica (RULE-006). Recomenda-se revisão da lista de IGs reconhecidas usada na validação.",
  },
  {
    title: "Nota técnica orienta sobre aceitação de laudos emitidos fora do escopo de acreditação",
    authority: "MAPA",
    publicationType: "manual",
    summary:
      "Orienta despachantes e importadores sobre os procedimentos aceitáveis quando o laudo de análise indica ensaios fora do escopo de acreditação do laboratório emissor.",
    aiImpact:
      "Relacionado às regras RULE-011 e RULE-012. Reforça que a revisão humana permanece obrigatória nesses casos — nenhuma automação adicional recomendada.",
  },
];

export interface SimulateSourceCheckResult {
  success: true;
  newItemCreated: boolean;
  itemId: string | null;
}

/**
 * Simula uma verificação de fonte regulatória: sempre atualiza
 * `lastCheckedAt` e, com 50% de chance, "descobre" uma nova publicação
 * plausível — para dar a sensação de um monitor vivo sem depender de
 * integração externa real neste MVP.
 */
export async function simulateSourceCheck(
  sourceId: string,
): Promise<SimulateSourceCheckResult | { success: false; error: string }> {
  const tenant = await requireTenant();

  const source = await prisma.regulatorySource.findUnique({ where: { id: sourceId } });
  if (!source) {
    return { success: false, error: "Fonte regulatória não encontrada." };
  }

  const now = new Date();
  await prisma.regulatorySource.update({ where: { id: sourceId }, data: { lastCheckedAt: now } });

  const foundNewItem = Math.random() < 0.5;
  let newItemId: string | null = null;

  if (foundNewItem) {
    const template = SIMULATED_ITEM_TEMPLATES[Math.floor(Math.random() * SIMULATED_ITEM_TEMPLATES.length)];
    const item = await prisma.regulatoryItem.create({
      data: {
        organizationId: tenant.organizationId,
        sourceId: source.id,
        title: template.title,
        authority: template.authority,
        publicationType: template.publicationType,
        url: source.url,
        publishedAt: now,
        status: "novo",
        summary: template.summary,
        aiImpact: template.aiImpact,
      },
    });
    newItemId = item.id;
  }

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    action: "verificacao_fonte_simulada",
    entityType: "regulatory_source",
    entityId: source.id,
    after: { lastCheckedAt: now, newItemId },
  });

  revalidatePath("/app/regulatory-monitor");
  return { success: true, newItemCreated: foundNewItem, itemId: newItemId };
}

export async function updateRegulatoryItemStatus(
  itemId: string,
  status: "em_analise" | "aprovado" | "rejeitado",
  reviewerId: string,
): Promise<ActionResult> {
  const tenant = await requireTenant();

  const item = await prisma.regulatoryItem.findUnique({ where: { id: itemId } });
  if (!item) {
    return { success: false, error: "Item regulatório não encontrado." };
  }

  const updated = await prisma.regulatoryItem.update({
    where: { id: itemId },
    data: { status, reviewerId },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    action: "item_regulatorio_status_alterado",
    entityType: "regulatory_item",
    entityId: item.id,
    before: { status: item.status },
    after: { status: updated.status, reviewerId },
  });

  revalidatePath("/app/regulatory-monitor");
  return { success: true };
}

export interface ConvertRegulatoryItemToRuleInput {
  itemId: string;
  category: RuleCategory;
  severity: AlertSeverity;
  ruleName: string;
  ruleDescription: string;
  errorMessage: string;
}

export async function convertRegulatoryItemToRule(
  input: ConvertRegulatoryItemToRuleInput,
): Promise<ActionResult<{ ruleId: string }>> {
  const tenant = await requireTenant();

  const item = await prisma.regulatoryItem.findUnique({ where: { id: input.itemId } });
  if (!item) {
    return { success: false, error: "Item regulatório não encontrado." };
  }
  if (item.status !== "aprovado") {
    return { success: false, error: "Somente itens aprovados podem ser convertidos em regra." };
  }

  const code = `CUSTOM-${Date.now().toString(36).toUpperCase()}`;

  const newRule = await prisma.validationRule.create({
    data: {
      organizationId: tenant.organizationId,
      code,
      name: input.ruleName,
      description: input.ruleDescription,
      category: input.category,
      severity: input.severity,
      sourceType: "normativa",
      sourceReference: item.url,
      version: 1,
      status: "ativa",
      errorMessage: input.errorMessage,
    },
  });

  await prisma.regulatoryItem.update({
    where: { id: item.id },
    data: { status: "convertido_em_regra", linkedRuleId: newRule.id },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    action: AUDIT_ACTIONS.REGULATORY_ITEM_CONVERTED,
    entityType: "regulatory_item",
    entityId: item.id,
    after: { linkedRuleId: newRule.id, ruleCode: newRule.code },
  });

  revalidatePath("/app/rules");
  revalidatePath("/app/regulatory-monitor");
  return { success: true, ruleId: newRule.id };
}
