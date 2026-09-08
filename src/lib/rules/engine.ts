import type { AlertSeverity, DocumentType } from "@/lib/constants";
import type { DocumentFieldSet } from "./calculations";
import { scoreDossier } from "./calculations";
import { RULE_DEFINITIONS, type RuleDefinition, type RuleDossierContext, type RuleFinding } from "./definitions";

export interface EngineInput {
  dossier: RuleDossierContext;
  documents: DocumentFieldSet[];
  /** Regras ativas a executar; por padrão, todas as regras do catálogo. */
  rules?: RuleDefinition[];
}

export interface EngineFinding extends RuleFinding {
  ruleCode: string;
  severity: AlertSeverity;
}

export interface EngineResult {
  findings: EngineFinding[];
  score: number;
  rulesVersionSnapshot: { code: string; name: string }[];
}

export function runRuleEngine(input: EngineInput): EngineResult {
  const rules = input.rules ?? RULE_DEFINITIONS;
  const presentDocumentTypes = Array.from(new Set(input.documents.map((d) => d.documentType))) as DocumentType[];

  const findings: EngineFinding[] = [];
  for (const rule of rules) {
    const results = rule.evaluate({
      dossier: input.dossier,
      documents: input.documents,
      presentDocumentTypes,
    });
    for (const finding of results) {
      findings.push({
        ...finding,
        ruleCode: rule.code,
        severity: finding.severity ?? rule.severity,
      });
    }
  }

  const score = scoreDossier(findings.map((f) => ({ severity: f.severity })));

  return {
    findings,
    score,
    rulesVersionSnapshot: rules.map((r) => ({ code: r.code, name: r.name })),
  };
}
