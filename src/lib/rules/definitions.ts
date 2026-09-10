import { DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENT_TYPES, type AlertSeverity, type DocumentType, type RuleCategory } from "@/lib/constants";
import {
  compareBrand,
  compareNormalized,
  detectBoxBottleMistake,
  type DocumentFieldSet,
  validateBatchConsistency,
  validateFieldPresence,
  validateGeographicalIndication,
  validateLabReportPresence,
  validateProducerConsistency,
} from "./calculations";

export interface RuleDossierContext {
  brand: string;
  productName: string;
  vintage?: string | null;
  geographicalIndication?: string | null;
  batchNumber?: string | null;
  packageCount?: number | null;
  unitsPerPackage?: number | null;
  unitCapacityLiters?: number | null;
  informedVolumeLiters?: number | null;
}

export interface RuleEvaluationContext {
  dossier: RuleDossierContext;
  documents: DocumentFieldSet[];
  presentDocumentTypes: DocumentType[];
}

export interface RuleFinding {
  severity?: AlertSeverity;
  title: string;
  message: string;
  recommendation?: string;
  evidence?: unknown;
}

export interface RuleDefinition {
  code: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: AlertSeverity;
  sourceType: "normativa" | "interna";
  sourceReference?: string;
  errorMessage: string;
  suggestion?: string;
  evaluate: (ctx: RuleEvaluationContext) => RuleFinding[];
}

const LAB_REQUIRED_PARAMS = ["teor_alcoolico", "acidez_total", "acidez_volatil", "acucares_totais", "metanol", "ph"];
const LAB_PARAM_LABELS: Record<string, string> = {
  teor_alcoolico: "teor alcoólico",
  acidez_total: "acidez total",
  acidez_volatil: "acidez volátil",
  acucares_totais: "açúcares totais",
  metanol: "metanol",
  ph: "pH",
};

const OUT_OF_ACCREDITATION_MARKERS = ["fora de acreditação", "fora da acreditação", "não acreditado", "nao acreditado"];
const SAMPLING_DISCLAIMER_MARKERS = ["amostragem não é responsabilidade", "amostragem nao e responsabilidade", "amostragem por conta do cliente"];

export const RULE_DEFINITIONS: RuleDefinition[] = [
  {
    code: "RULE-001",
    name: "Presença de lote",
    description: "O número de lote deve estar presente nos documentos críticos do dossiê.",
    category: "lote",
    severity: "critica",
    sourceType: "interna",
    errorMessage: "Número de lote ausente em um ou mais documentos críticos.",
    suggestion: "Solicitar reenvio do documento com o número de lote visível ou complementar a informação.",
    evaluate: ({ documents }) => {
      const result = validateFieldPresence(documents, "numero_lote", [
        "anexo_ix",
        "laudo_analise",
        "certificado_origem",
        "invoice",
        "packing_list",
      ]);
      if (result.present) return [];
      return [
        {
          title: "Lote ausente em documento crítico",
          message: `O número de lote não foi identificado em: ${result.missingFrom.map((d) => DOCUMENT_TYPE_LABELS[d]).join(", ")}.`,
          recommendation: "Solicitar complementação do documento com o número de lote.",
          evidence: { missingFrom: result.missingFrom },
        },
      ];
    },
  },
  {
    code: "RULE-002",
    name: "Consistência de lote",
    description: "O número de lote deve ser idêntico entre todos os documentos que o mencionam.",
    category: "lote",
    severity: "critica",
    sourceType: "interna",
    errorMessage: "Divergência no número de lote entre documentos.",
    suggestion: "Confirmar com o exportador qual é o lote correto e corrigir o documento divergente.",
    evaluate: ({ documents }) => {
      const result = validateBatchConsistency(documents);
      if (result.consistent) return [];
      return [
        {
          title: "Divergência de lote entre documentos",
          message: `O número de lote diverge entre documentos: ${result.values
            .map((v) => `${DOCUMENT_TYPE_LABELS[v.documentType]} = "${v.value}"`)
            .join("; ")}.`,
          recommendation: "Verificar qual documento contém o lote correto e solicitar correção do divergente.",
          evidence: { values: result.values },
        },
      ];
    },
  },
  {
    code: "RULE-003",
    name: "Presença e consistência do número do laudo",
    description: "O número do laudo deve estar presente e coincidir entre o Anexo IX e o documento de análise emitido pelo laboratório.",
    category: "laboratorio",
    severity: "alta",
    sourceType: "interna",
    errorMessage: "Número do laudo ausente ou divergente entre Anexo IX e laudo de análise.",
    suggestion: "Verificar se o laudo anexado corresponde ao número informado no Anexo IX ou solicitar correção ao exportador.",
    evaluate: ({ documents }) => {
      const result = validateLabReportPresence(documents);
      if (!result.present) {
        return [
          {
            title: "Número do laudo ausente",
            message: `O número do laudo não foi encontrado em: ${result.missingFrom.map((d) => DOCUMENT_TYPE_LABELS[d]).join(", ")}.`,
            recommendation: "Complementar o documento com o número do laudo antes do registro.",
            evidence: { missingFrom: result.missingFrom },
          },
        ];
      }

      // Comparação de consistência entre documentos que informam numero_laudo
      const laudoDocs = documents.filter((d) => d.fields.numero_laudo?.trim());
      if (laudoDocs.length >= 2) {
        const [first, ...rest] = laudoDocs;
        const findings: RuleFinding[] = [];
        for (const doc of rest) {
          if (!compareNormalized(first.fields.numero_laudo, doc.fields.numero_laudo)) {
            findings.push({
              title: "Número de relatório/laudo divergente",
              message: `O número do laudo em ${DOCUMENT_TYPE_LABELS[first.documentType]} ("${first.fields.numero_laudo}") diverge de ${DOCUMENT_TYPE_LABELS[doc.documentType]} ("${doc.fields.numero_laudo}").`,
              recommendation: "Confirmar qual é o laudo correto e solicitar a correção dos documentos divergentes.",
              evidence: {
                expected: { documentType: first.documentType, value: first.fields.numero_laudo },
                divergent: { documentType: doc.documentType, value: doc.fields.numero_laudo },
              },
            });
          }
        }
        if (findings.length > 0) return findings;
      }

      return [];
    },
  },
  {
    code: "RULE-004",
    name: "Consistência de marca",
    description: "A marca deve ser coerente entre certificado, laudo, rótulo, CII e Anexo IX, com tratamento de equivalência para a safra.",
    category: "marca",
    severity: "alta",
    sourceType: "interna",
    errorMessage: "Divergência de marca não explicada entre documentos.",
    suggestion: "Confirmar a marca correta com o rótulo e registrar justificativa para a divergência.",
    evaluate: ({ documents, dossier }) => {
      const values = documents.filter((d) => d.fields.marca?.trim()).map((d) => ({ documentType: d.documentType, value: d.fields.marca as string }));
      if (values.length < 2) return [];
      const [baseline, ...rest] = values;
      const findings: RuleFinding[] = [];
      for (const entry of rest) {
        const comparison = compareBrand(baseline.value, entry.value, { vintage: dossier.vintage });
        if (comparison.kind === "divergent") {
          findings.push({
            title: "Divergência de marca",
            message: `A marca em ${DOCUMENT_TYPE_LABELS[baseline.documentType]} ("${baseline.value}") diverge da marca em ${DOCUMENT_TYPE_LABELS[entry.documentType]} ("${entry.value}").`,
            recommendation: "Confirmar com o rótulo qual é a grafia correta da marca e justificar ou corrigir a divergência.",
            evidence: { baseline, divergent: entry },
          });
        } else if (comparison.kind === "equivalent_with_note") {
          findings.push({
            severity: "informativa",
            title: "Possível equivalência de marca (safra)",
            message: `Marca em ${DOCUMENT_TYPE_LABELS[baseline.documentType]} ("${baseline.value}") e em ${DOCUMENT_TYPE_LABELS[entry.documentType]} ("${entry.value}") apresentam diferença textual. ${comparison.note ?? ""}`,
            recommendation: "Revisão humana recomendada para confirmar a equivalência antes de aprovar.",
            evidence: { baseline, compared: entry },
          });
        }
      }
      return findings;
    },
  },
  {
    code: "RULE-005",
    name: "Consistência de denominação",
    description: "A denominação do produto deve ser compatível entre os documentos do dossiê.",
    category: "denominacao",
    severity: "alta",
    sourceType: "interna",
    errorMessage: "Divergência na denominação do produto entre documentos.",
    suggestion: "Confirmar a denominação correta e padronizar nos documentos divergentes.",
    evaluate: ({ documents }) => {
      const values = documents.filter((d) => d.fields.denominacao?.trim()).map((d) => ({ documentType: d.documentType, value: d.fields.denominacao as string }));
      if (values.length < 2) return [];
      const [baseline, ...rest] = values;
      const findings: RuleFinding[] = [];
      for (const entry of rest) {
        if (!compareNormalized(baseline.value, entry.value)) {
          findings.push({
            title: "Divergência de denominação",
            message: `A denominação em ${DOCUMENT_TYPE_LABELS[baseline.documentType]} ("${baseline.value}") diverge de ${DOCUMENT_TYPE_LABELS[entry.documentType]} ("${entry.value}").`,
            recommendation: "Padronizar a denominação do produto entre os documentos.",
            evidence: { baseline, divergent: entry },
          });
        }
      }
      return findings;
    },
  },
  {
    code: "RULE-006",
    name: "Consistência de indicação geográfica",
    description: "A indicação geográfica, quando presente, deve ser coerente entre rótulo e demais documentos.",
    category: "indicacao_geografica",
    severity: "alta",
    sourceType: "interna",
    errorMessage: "Divergência de indicação geográfica entre documentos.",
    suggestion: "Confirmar a indicação geográfica correta com o rótulo e o certificado de origem.",
    evaluate: ({ documents }) => {
      const result = validateGeographicalIndication(documents);
      if (result.consistent) return [];
      return [
        {
          title: "Divergência de indicação geográfica",
          message: `A indicação geográfica diverge entre documentos: ${result.values
            .map((v) => `${DOCUMENT_TYPE_LABELS[v.documentType]} = "${v.value}"`)
            .join("; ")}.`,
          recommendation: "Confirmar com o certificado de origem e o rótulo qual é a IG correta.",
          evidence: { values: result.values },
        },
      ];
    },
  },
  {
    code: "RULE-007",
    name: "Consistência de produtor/engarrafador",
    description: "O produtor/engarrafador deve ser coerente entre certificado, laudo e demais documentos.",
    category: "produtor",
    severity: "alta",
    sourceType: "interna",
    errorMessage: "Divergência de produtor/engarrafador entre documentos.",
    suggestion: "Confirmar o produtor/engarrafador correto junto ao exportador.",
    evaluate: ({ documents }) => {
      const result = validateProducerConsistency(documents);
      if (result.consistent) return [];
      return [
        {
          title: "Divergência de produtor/engarrafador",
          message: `O produtor/engarrafador diverge entre documentos: ${result.values
            .map((v) => `${DOCUMENT_TYPE_LABELS[v.documentType]} = "${v.value}"`)
            .join("; ")}.`,
          recommendation: "Confirmar com o certificado de origem quem é o produtor/engarrafador correto.",
          evidence: { values: result.values },
        },
      ];
    },
  },
  {
    code: "RULE-008",
    name: "Cálculo de volume total",
    description: "volume_total = número_de_embalagens × unidades_por_embalagem × capacidade_unitária.",
    category: "volume",
    severity: "critica",
    sourceType: "interna",
    errorMessage: "Volume total informado diverge do volume calculado.",
    suggestion: "Recalcular o volume total e corrigir o documento com o valor divergente.",
    evaluate: ({ dossier }) => {
      const { packageCount, unitsPerPackage, unitCapacityLiters, informedVolumeLiters } = dossier;
      if (!packageCount || !unitsPerPackage || !unitCapacityLiters || !informedVolumeLiters) return [];
      const calculated = packageCount * unitsPerPackage * unitCapacityLiters;
      const diff = Math.abs(calculated - informedVolumeLiters);
      if (diff <= 0.5) return [];
      return [
        {
          title: "Divergência no volume total",
          message: `Volume informado (${informedVolumeLiters.toLocaleString("pt-BR")} L) diverge do volume calculado (${calculated.toLocaleString("pt-BR")} L = ${packageCount} × ${unitsPerPackage} × ${unitCapacityLiters} L).`,
          recommendation: "Recalcular o volume total a partir do número de embalagens, unidades por embalagem e capacidade unitária.",
          evidence: { packageCount, unitsPerPackage, unitCapacityLiters, informedVolumeLiters, calculated },
        },
      ];
    },
  },
  {
    code: "RULE-009",
    name: "Erro caixa versus garrafa",
    description: "Detecta o erro clássico de tratar número de caixas como número de garrafas no cálculo de volume.",
    category: "volume",
    severity: "critica",
    sourceType: "interna",
    errorMessage: "Volume informado corresponde ao número de caixas tratado como número de garrafas.",
    suggestion: "Multiplicar corretamente pelo número de unidades por embalagem antes de informar o volume total.",
    evaluate: ({ dossier }) => {
      const { packageCount, unitsPerPackage, unitCapacityLiters, informedVolumeLiters } = dossier;
      if (!packageCount || !unitsPerPackage || !unitCapacityLiters || !informedVolumeLiters) return [];
      const result = detectBoxBottleMistake(packageCount, unitsPerPackage, unitCapacityLiters, informedVolumeLiters);
      if (!result.detected) return [];
      return [
        {
          title: "Erro caixa × garrafa no volume total",
          message: `${packageCount} caixas de ${unitsPerPackage} garrafas de ${unitCapacityLiters} L não são ${result.mistakenAssumedTotalLiters.toLocaleString("pt-BR")} L, e sim ${result.correctTotalLiters.toLocaleString("pt-BR")} L. O valor informado parece ter tratado o número de caixas como se fosse o número de garrafas.`,
          recommendation: `Corrigir o volume total informado para ${result.correctTotalLiters.toLocaleString("pt-BR")} L.`,
          evidence: result,
        },
      ];
    },
  },
  {
    code: "RULE-010",
    name: "Parâmetros laboratoriais presentes",
    description: "O laudo deve conter os parâmetros físico-químicos mínimos exigidos.",
    category: "laboratorio",
    severity: "alta",
    sourceType: "interna",
    errorMessage: "Parâmetros laboratoriais mínimos ausentes no laudo.",
    suggestion: "Solicitar laudo complementar com os parâmetros ausentes.",
    evaluate: ({ documents }) => {
      const laudo = documents.find((d) => d.documentType === "laudo_analise");
      if (!laudo) return [];
      const missing = LAB_REQUIRED_PARAMS.filter((key) => !laudo.fields[key]?.trim());
      if (missing.length === 0) return [];
      return [
        {
          title: "Parâmetros laboratoriais ausentes",
          message: `O laudo de análise não informa: ${missing.map((k) => LAB_PARAM_LABELS[k]).join(", ")}.`,
          recommendation: "Solicitar laudo complementar contendo todos os parâmetros mínimos.",
          evidence: { missing },
        },
      ];
    },
  },
  {
    code: "RULE-011",
    name: "Ensaios fora de acreditação",
    description: "Registra ressalva quando o laudo indica ensaios realizados fora do escopo de acreditação, sem reprovar automaticamente.",
    category: "laboratorio",
    severity: "media",
    sourceType: "interna",
    errorMessage: "Laudo indica ensaio(s) fora do escopo de acreditação.",
    suggestion: "Revisão humana obrigatória antes de aceitar o laudo.",
    evaluate: ({ documents }) => {
      const laudo = documents.find((d) => d.documentType === "laudo_analise");
      const text = laudo?.fields.observacao_acreditacao?.toLowerCase() ?? "";
      if (!OUT_OF_ACCREDITATION_MARKERS.some((marker) => text.includes(marker))) return [];
      return [
        {
          title: "Ensaio fora de acreditação",
          message: "O laudo de análise indica que um ou mais ensaios foram realizados fora do escopo de acreditação do laboratório.",
          recommendation: "Não reprovar automaticamente — exige revisão humana e, se necessário, laudo complementar.",
          evidence: { observacao: laudo?.fields.observacao_acreditacao },
        },
      ];
    },
  },
  {
    code: "RULE-012",
    name: "Amostragem não atribuída ao laboratório",
    description: "Registra ressalva quando o laudo indica que a amostragem não é de responsabilidade do laboratório emissor.",
    category: "laboratorio",
    severity: "media",
    sourceType: "interna",
    errorMessage: "Laudo indica que a amostragem não é responsabilidade do laboratório.",
    suggestion: "Revisão humana obrigatória para validar a cadeia de custódia da amostra.",
    evaluate: ({ documents }) => {
      const laudo = documents.find((d) => d.documentType === "laudo_analise");
      const text = laudo?.fields.observacao_acreditacao?.toLowerCase() ?? "";
      if (!SAMPLING_DISCLAIMER_MARKERS.some((marker) => text.includes(marker))) return [];
      return [
        {
          title: "Amostragem não atribuída ao laboratório",
          message: "O laudo registra ressalva de que a amostragem não é de responsabilidade do laboratório emissor.",
          recommendation: "Revisão humana obrigatória antes de aceitar o resultado.",
          evidence: { observacao: laudo?.fields.observacao_acreditacao },
        },
      ];
    },
  },
  {
    code: "RULE-013",
    name: "Documento obrigatório ausente",
    description: "Para dossiê de vinho, Anexo IX, Certificado de Origem, Laudo de Análise, Invoice, Packing List e Rótulo são obrigatórios.",
    category: "documentacao",
    severity: "alta",
    sourceType: "interna",
    errorMessage: "Documento obrigatório ausente no dossiê.",
    suggestion: "Solicitar o envio do documento faltante antes de prosseguir com a validação.",
    evaluate: ({ presentDocumentTypes }) => {
      const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !presentDocumentTypes.includes(type));
      if (missing.length === 0) return [];
      return missing.map((type) => ({
        title: `Documento obrigatório ausente: ${DOCUMENT_TYPE_LABELS[type]}`,
        message: `O dossiê ainda não possui um documento do tipo "${DOCUMENT_TYPE_LABELS[type]}", obrigatório para dossiês de vinho.`,
        recommendation: "Solicitar o envio do documento ao importador/despachante.",
        evidence: { documentType: type },
      }));
    },
  },
  {
    code: "RULE-014",
    name: "Validação humana obrigatória",
    description: "Nenhum dossiê pode ser marcado como aprovado apenas pela IA — exige usuário revisor e data de aprovação.",
    category: "governanca",
    severity: "informativa",
    sourceType: "interna",
    errorMessage: "Aprovação final requer revisor humano identificado.",
    suggestion: "Um analista ou gestor deve revisar e aprovar formalmente o dossiê.",
    // Regra de governança de processo, aplicada na ação de aprovação (não gera alerta por documento).
    evaluate: () => [],
  },
  {
    code: "RULE-015",
    name: "Versão de regra",
    description: "Toda validação deve registrar a versão de cada regra aplicada.",
    category: "governanca",
    severity: "informativa",
    sourceType: "interna",
    errorMessage: "Execução de validação sem snapshot de versão das regras.",
    suggestion: "Garantir que o motor de regras sempre grave `rulesVersionSnapshot`.",
    // Aplicada estruturalmente pelo engine.ts (todo ValidationRun grava rulesVersionSnapshot).
    evaluate: () => [],
  },
];

export function getRuleDefinition(code: string): RuleDefinition | undefined {
  return RULE_DEFINITIONS.find((r) => r.code === code);
}
