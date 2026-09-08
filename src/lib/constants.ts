// Valores categóricos centrais do domínio. SQLite não suporta enum nativo no
// Prisma, então essas listas são a fonte única de verdade tanto para validação
// (zod) quanto para rótulos/cores na UI.

export const DOSSIER_STATUSES = [
  "rascunho",
  "documentos_pendentes",
  "processando",
  "em_revisao",
  "aprovado",
  "aprovado_com_ressalvas",
  "reprovado",
  "arquivado",
] as const;
export type DossierStatus = (typeof DOSSIER_STATUSES)[number];

export const DOSSIER_STATUS_LABELS: Record<DossierStatus, string> = {
  rascunho: "Rascunho",
  documentos_pendentes: "Documentos pendentes",
  processando: "Processando",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  aprovado_com_ressalvas: "Aprovado com ressalvas",
  reprovado: "Reprovado",
  arquivado: "Arquivado",
};

export const DOSSIER_STATUS_BADGE: Record<DossierStatus, "neutral" | "info" | "warning" | "success" | "destructive"> = {
  rascunho: "neutral",
  documentos_pendentes: "warning",
  processando: "info",
  em_revisao: "info",
  aprovado: "success",
  aprovado_com_ressalvas: "warning",
  reprovado: "destructive",
  arquivado: "neutral",
};

export const ALERT_SEVERITIES = ["critica", "alta", "media", "baixa", "informativa"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  informativa: "Informativa",
};

export const SEVERITY_WEIGHTS: Record<AlertSeverity, number> = {
  critica: 30,
  alta: 15,
  media: 7,
  baixa: 3,
  informativa: 0,
};

export const SEVERITY_BADGE: Record<AlertSeverity, "critical" | "high" | "medium" | "info" | "neutral"> = {
  critica: "critical",
  alta: "high",
  media: "medium",
  baixa: "info",
  informativa: "neutral",
};

export const ALERT_STATUSES = ["aberto", "confirmado", "rejeitado", "falso_positivo", "resolvido"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  aberto: "Aberto",
  confirmado: "Confirmado",
  rejeitado: "Rejeitado",
  falso_positivo: "Falso positivo",
  resolvido: "Resolvido",
};

export const DOCUMENT_TYPES = [
  "anexo_ix",
  "certificado_origem",
  "laudo_analise",
  "cii",
  "invoice",
  "packing_list",
  "rotulo",
  "complementar",
  "outro",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  anexo_ix: "Anexo IX",
  certificado_origem: "Certificado de Origem",
  laudo_analise: "Laudo de Análise",
  cii: "CII — Certificado de Inspeção de Importação",
  invoice: "Invoice",
  packing_list: "Packing List",
  rotulo: "Rótulo",
  complementar: "Documento complementar",
  outro: "Outro",
};

/** Documentos exigidos para todo dossiê de vinho (RULE-013). */
export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
  "anexo_ix",
  "certificado_origem",
  "laudo_analise",
  "invoice",
  "packing_list",
  "rotulo",
];

export const DOCUMENT_UPLOAD_STATUSES = ["enviado", "processando", "erro"] as const;
export const DOCUMENT_EXTRACTION_STATUSES = ["pendente", "processando", "concluida", "erro"] as const;

export const ROLES = ["admin", "gestor", "analista"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin SaaS",
  gestor: "Gestor da Comissária",
  analista: "Analista Regulatório",
};

export const RULE_CATEGORIES = [
  "lote",
  "marca",
  "denominacao",
  "indicacao_geografica",
  "produtor",
  "volume",
  "laboratorio",
  "documentacao",
  "governanca",
] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  lote: "Lote",
  marca: "Marca",
  denominacao: "Denominação",
  indicacao_geografica: "Indicação Geográfica",
  produtor: "Produtor / Engarrafador",
  volume: "Volume e quantidade",
  laboratorio: "Parâmetros laboratoriais",
  documentacao: "Documentação obrigatória",
  governanca: "Governança e supervisão",
};

export const RULE_STATUSES = ["ativa", "inativa", "rascunho"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const REGULATORY_ITEM_STATUSES = [
  "novo",
  "em_analise",
  "aprovado",
  "rejeitado",
  "convertido_em_regra",
] as const;
export type RegulatoryItemStatus = (typeof REGULATORY_ITEM_STATUSES)[number];

export const REGULATORY_ITEM_STATUS_LABELS: Record<RegulatoryItemStatus, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  convertido_em_regra: "Convertido em regra",
};

export const REGULATORY_PUBLICATION_TYPES = [
  "lei",
  "decreto",
  "instrucao_normativa",
  "resolucao",
  "portaria",
  "noticia",
  "manual",
  "outro",
] as const;
export type RegulatoryPublicationType = (typeof REGULATORY_PUBLICATION_TYPES)[number];

export const REGULATORY_PUBLICATION_TYPE_LABELS: Record<RegulatoryPublicationType, string> = {
  lei: "Lei",
  decreto: "Decreto",
  instrucao_normativa: "Instrução Normativa",
  resolucao: "Resolução",
  portaria: "Portaria",
  noticia: "Notícia",
  manual: "Manual",
  outro: "Outro",
};

export const PLANS = ["starter", "professional", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

/** Classificação do score de conformidade (seção 7.7 do escopo). */
export function scoreClassification(score: number): {
  label: string;
  tone: "success" | "warning" | "destructive" | "neutral";
} {
  if (score >= 90) return { label: "Apto", tone: "success" };
  if (score >= 75) return { label: "Apto com ressalvas", tone: "warning" };
  if (score >= 50) return { label: "Pendente", tone: "warning" };
  return { label: "Não recomendado para registro", tone: "destructive" };
}
