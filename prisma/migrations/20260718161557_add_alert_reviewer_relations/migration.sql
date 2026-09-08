-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ValidationAlert" (
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
    CONSTRAINT "ValidationAlert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ValidationRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ValidationAlert_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "Profile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ValidationAlert_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Profile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ValidationAlert" ("confirmedById", "createdAt", "dossierId", "evidence", "id", "message", "organizationId", "recommendation", "reviewComment", "reviewedById", "ruleId", "severity", "status", "title", "updatedAt", "validationRunId") SELECT "confirmedById", "createdAt", "dossierId", "evidence", "id", "message", "organizationId", "recommendation", "reviewComment", "reviewedById", "ruleId", "severity", "status", "title", "updatedAt", "validationRunId" FROM "ValidationAlert";
DROP TABLE "ValidationAlert";
ALTER TABLE "new_ValidationAlert" RENAME TO "ValidationAlert";
CREATE INDEX "ValidationAlert_dossierId_idx" ON "ValidationAlert"("dossierId");
CREATE INDEX "ValidationAlert_severity_idx" ON "ValidationAlert"("severity");
CREATE INDEX "ValidationAlert_status_idx" ON "ValidationAlert"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
