-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "retentionDays" INTEGER NOT NULL DEFAULT 1825,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "internalNumber" TEXT NOT NULL,
    "importerName" TEXT NOT NULL,
    "exporterName" TEXT,
    "producerName" TEXT,
    "countryOrigin" TEXT,
    "productCategory" TEXT NOT NULL DEFAULT 'vinho',
    "productName" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "vintage" TEXT,
    "geographicalIndication" TEXT,
    "batchNumber" TEXT,
    "packageType" TEXT,
    "packageCount" INTEGER,
    "unitsPerPackage" INTEGER,
    "unitCapacityLiters" REAL,
    "informedVolumeLiters" REAL,
    "calculatedVolumeLiters" REAL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "complianceScore" INTEGER,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Dossier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dossier_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Profile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Dossier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadStatus" TEXT NOT NULL DEFAULT 'enviado',
    "extractionStatus" TEXT NOT NULL DEFAULT 'pendente',
    "confidenceScore" REAL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "confidence" REAL NOT NULL,
    "pageNumber" INTEGER,
    "boundingBox" TEXT,
    "sourceText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractedField_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExtractedField_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExtractedField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceReference" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "errorMessage" TEXT NOT NULL,
    "suggestion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ValidationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'concluida',
    "score" INTEGER,
    "rulesVersionSnapshot" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "ValidationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ValidationRun_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ValidationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "validationRunId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recommendation" TEXT,
    "evidence" TEXT,
    "confirmedById" TEXT,
    "reviewedById" TEXT,
    "reviewComment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ValidationAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ValidationAlert_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ValidationAlert_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ValidationAlert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ValidationRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegulatorySource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "checkFrequency" TEXT NOT NULL DEFAULT 'diaria',
    "lastCheckedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegulatorySource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegulatoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "publicationType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "summary" TEXT,
    "aiImpact" TEXT,
    "reviewerId" TEXT,
    "linkedRuleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegulatoryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegulatoryItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RegulatorySource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "dossierId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "metadataJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "validationRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Profile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Dossier_organizationId_idx" ON "Dossier"("organizationId");

-- CreateIndex
CREATE INDEX "Dossier_status_idx" ON "Dossier"("status");

-- CreateIndex
CREATE INDEX "Document_dossierId_idx" ON "Document"("dossierId");

-- CreateIndex
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");

-- CreateIndex
CREATE INDEX "ExtractedField_documentId_idx" ON "ExtractedField"("documentId");

-- CreateIndex
CREATE INDEX "ExtractedField_dossierId_idx" ON "ExtractedField"("dossierId");

-- CreateIndex
CREATE INDEX "ValidationRule_code_idx" ON "ValidationRule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationRule_code_version_organizationId_key" ON "ValidationRule"("code", "version", "organizationId");

-- CreateIndex
CREATE INDEX "ValidationRun_dossierId_idx" ON "ValidationRun"("dossierId");

-- CreateIndex
CREATE INDEX "ValidationAlert_dossierId_idx" ON "ValidationAlert"("dossierId");

-- CreateIndex
CREATE INDEX "ValidationAlert_severity_idx" ON "ValidationAlert"("severity");

-- CreateIndex
CREATE INDEX "ValidationAlert_status_idx" ON "ValidationAlert"("status");

-- CreateIndex
CREATE INDEX "RegulatoryItem_sourceId_idx" ON "RegulatoryItem"("sourceId");

-- CreateIndex
CREATE INDEX "RegulatoryItem_status_idx" ON "RegulatoryItem"("status");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_idx" ON "AuditEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AuditEvent_dossierId_idx" ON "AuditEvent"("dossierId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Report_dossierId_idx" ON "Report"("dossierId");
