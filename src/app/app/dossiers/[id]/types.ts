import type { TenantContext } from "@/lib/tenant";

export interface DossierDetailData {
  id: string;
  internalNumber: string;
  importerName: string;
  exporterName: string | null;
  producerName: string | null;
  countryOrigin: string | null;
  productName: string;
  brand: string;
  vintage: string | null;
  geographicalIndication: string | null;
  batchNumber: string | null;
  packageType: string | null;
  packageCount: number | null;
  unitsPerPackage: number | null;
  unitCapacityLiters: number | null;
  informedVolumeLiters: number | null;
  calculatedVolumeLiters: number | null;
  status: string;
  complianceScore: number | null;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface DocumentData {
  id: string;
  documentType: string;
  filename: string;
  mimeType: string;
  size: number;
  checksum: string;
  uploadStatus: string;
  extractionStatus: string;
  confidenceScore: number | null;
  uploadedByName: string;
  createdAt: string;
}

export interface ExtractedFieldData {
  id: string;
  documentId: string;
  fieldKey: string;
  fieldValue: string;
  confidence: number;
}

export interface ValidationRunData {
  id: string;
  status: string;
  score: number | null;
  rulesVersionSnapshot: string;
  startedAt: string;
  completedAt: string | null;
}

export interface AlertData {
  id: string;
  validationRunId: string;
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  recommendation: string | null;
  evidence: string | null;
  reviewComment: string | null;
  reviewedByName: string | null;
  confirmedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventData {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: string | null;
  afterJson: string | null;
  userName: string;
  createdAt: string;
}

export interface ReportData {
  id: string;
  status: string;
  title: string;
  summary: string;
  generatedByName: string;
  approvedByName: string | null;
  generatedAt: string;
  approvedAt: string | null;
}

export interface MemberData {
  userId: string;
  name: string;
  role: string;
}

export interface RuleSummary {
  id: string;
  code: string;
  name: string;
  category: string;
  severity: string;
  version: number;
}

export interface DossierDetailProps {
  tenant: TenantContext;
  dossier: DossierDetailData;
  documents: DocumentData[];
  extractedFields: ExtractedFieldData[];
  validationRuns: ValidationRunData[];
  alerts: AlertData[];
  auditEvents: AuditEventData[];
  reports: ReportData[];
  members: MemberData[];
  appliedRuleCodes: string[];
  allRules: RuleSummary[];
  missingRequiredDocuments: { type: string; label: string }[];
  isExtractionSimulated: boolean;
}
