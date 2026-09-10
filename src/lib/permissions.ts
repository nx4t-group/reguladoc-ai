import type { Role } from "./constants";

export const CAPABILITIES = [
  "DOSSIER_CREATE",
  "DOSSIER_EDIT",
  "DOCUMENT_UPLOAD",
  "DOCUMENT_REVIEW",
  "FINDING_RESOLVE",
  "FINDING_RECLASSIFY",
  "RULE_VIEW",
  "RULE_MANAGE",
  "DOSSIER_APPROVE",
  "ADMIN_USERS",
  "ADMIN_TENANT",
  "GOVERNANCE_VIEW",
  "GOVERNANCE_MANAGE",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  admin: [
    "DOSSIER_CREATE",
    "DOSSIER_EDIT",
    "DOCUMENT_UPLOAD",
    "DOCUMENT_REVIEW",
    "FINDING_RESOLVE",
    "FINDING_RECLASSIFY",
    "RULE_VIEW",
    "RULE_MANAGE",
    "DOSSIER_APPROVE",
    "ADMIN_USERS",
    "ADMIN_TENANT",
    "GOVERNANCE_VIEW",
    "GOVERNANCE_MANAGE",
  ],
  gestor: [
    "DOSSIER_CREATE",
    "DOSSIER_EDIT",
    "DOCUMENT_UPLOAD",
    "DOCUMENT_REVIEW",
    "FINDING_RESOLVE",
    "FINDING_RECLASSIFY",
    "RULE_VIEW",
    "RULE_MANAGE",
    "DOSSIER_APPROVE",
    "GOVERNANCE_VIEW",
    "GOVERNANCE_MANAGE",
  ],
  analista: [
    "DOSSIER_CREATE",
    "DOSSIER_EDIT",
    "DOCUMENT_UPLOAD",
    "DOCUMENT_REVIEW",
    "FINDING_RESOLVE",
    "RULE_VIEW",
  ],
};

/**
 * Verifica se um papel específico possui uma capability.
 */
export function hasCapability(role: Role, capability: Capability): boolean {
  const caps = ROLE_CAPABILITIES[role];
  return caps ? caps.includes(capability) : false;
}

/**
 * Lança erro se o usuário não possuir a capability exigida.
 */
export function assertCapability(role: Role, capability: Capability, message?: string) {
  if (!hasCapability(role, capability)) {
    throw new Error(
      message || `Acesso negado: a permissão [${capability}] é exigida para executar esta ação.`
    );
  }
}
