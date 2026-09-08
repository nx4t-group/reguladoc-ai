"use server";

import { revalidatePath } from "next/cache";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import type { AlertSeverity, DocumentType } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { DocumentFieldSet } from "@/lib/rules/calculations";
import { runRuleEngine, type EngineFinding } from "@/lib/rules/engine";
import { requireTenant } from "@/lib/tenant";

type ActionResult<T = Record<string, unknown>> = ({ success: true } & T) | { success: false; error: string };

/**
 * Alterna o status de uma regra entre "ativa" e "inativa". Regras globais
 * (organizationId nulo) são dados de plataforma compartilhados neste MVP —
 * não há necessidade de restringir por organização para esta operação.
 */
export async function toggleRuleStatus(ruleId: string): Promise<ActionResult<{ status: string }>> {
  const tenant = await requireTenant();

  const rule = await prisma.validationRule.findUnique({ where: { id: ruleId } });
  if (!rule) {
    return { success: false, error: "Regra não encontrada." };
  }

  const newStatus = rule.status === "ativa" ? "inativa" : "ativa";
  const updated = await prisma.validationRule.update({
    where: { id: ruleId },
    data: { status: newStatus },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    action: AUDIT_ACTIONS.RULE_CHANGED,
    entityType: "validation_rule",
    entityId: rule.id,
    before: { status: rule.status },
    after: { status: updated.status },
    metadata: { code: rule.code, version: rule.version },
  });

  revalidatePath("/app/rules");
  return { success: true, status: updated.status };
}

export interface CreateRuleVersionInput {
  ruleId: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  sourceReference?: string;
  suggestion?: string;
}

/**
 * Cria uma nova versão de uma regra existente, sempre vinculada à
 * organização do usuário (novas versões nunca sobrescrevem uma regra
 * global). A versão anterior é encerrada (status inativa, effectiveTo = agora).
 */
export async function createRuleVersion(input: CreateRuleVersionInput): Promise<ActionResult<{ ruleId: string }>> {
  const tenant = await requireTenant();

  const existing = await prisma.validationRule.findUnique({ where: { id: input.ruleId } });
  if (!existing) {
    return { success: false, error: "Regra não encontrada." };
  }

  const now = new Date();

  const newRule = await prisma.validationRule.create({
    data: {
      organizationId: tenant.organizationId,
      code: existing.code,
      name: input.name,
      description: input.description,
      category: existing.category,
      severity: input.severity,
      sourceType: existing.sourceType,
      sourceReference: input.sourceReference || null,
      version: existing.version + 1,
      effectiveFrom: now,
      status: "ativa",
      errorMessage: existing.errorMessage,
      suggestion: input.suggestion || null,
    },
  });

  await prisma.validationRule.update({
    where: { id: existing.id },
    data: { status: "inativa", effectiveTo: now },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    action: AUDIT_ACTIONS.RULE_CHANGED,
    entityType: "validation_rule",
    entityId: newRule.id,
    before: { code: existing.code, version: existing.version, status: existing.status },
    after: { code: newRule.code, version: newRule.version, status: newRule.status },
  });

  revalidatePath("/app/rules");
  return { success: true, ruleId: newRule.id };
}

export interface SimulateRuleResult {
  success: true;
  dossierInternalNumber: string;
  findings: EngineFinding[];
}

/**
 * Simulação somente-leitura: executa o motor de regras sobre o dossiê de
 * exemplo (DEMO-IMP-0002, com fallback para qualquer dossiê da organização)
 * e devolve apenas os achados da regra informada. Não grava nada no banco.
 */
export async function simulateRuleAgainstDemoDossier(
  ruleCode: string,
): Promise<SimulateRuleResult | { success: false; error: string }> {
  const tenant = await requireTenant();

  let dossier = await prisma.dossier.findFirst({
    where: { organizationId: tenant.organizationId, internalNumber: "DEMO-IMP-0002" },
  });

  if (!dossier) {
    dossier = await prisma.dossier.findFirst({
      where: { organizationId: tenant.organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!dossier) {
    return { success: false, error: "Nenhum dossiê disponível nesta organização para simulação." };
  }

  const [documents, fields] = await Promise.all([
    prisma.document.findMany({ where: { dossierId: dossier.id, organizationId: tenant.organizationId } }),
    prisma.extractedField.findMany({ where: { dossierId: dossier.id, organizationId: tenant.organizationId } }),
  ]);

  const documentFieldSets: DocumentFieldSet[] = documents.map((doc) => ({
    documentType: doc.documentType as DocumentType,
    documentId: doc.id,
    fields: Object.fromEntries(fields.filter((f) => f.documentId === doc.id).map((f) => [f.fieldKey, f.fieldValue])),
  }));

  const result = runRuleEngine({
    dossier: {
      brand: dossier.brand,
      productName: dossier.productName,
      vintage: dossier.vintage,
      geographicalIndication: dossier.geographicalIndication,
      batchNumber: dossier.batchNumber,
      packageCount: dossier.packageCount,
      unitsPerPackage: dossier.unitsPerPackage,
      unitCapacityLiters: dossier.unitCapacityLiters,
      informedVolumeLiters: dossier.informedVolumeLiters,
    },
    documents: documentFieldSets,
  });

  return {
    success: true,
    dossierInternalNumber: dossier.internalNumber,
    findings: result.findings.filter((f) => f.ruleCode === ruleCode),
  };
}
