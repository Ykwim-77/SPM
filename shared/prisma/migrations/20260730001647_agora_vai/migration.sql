-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "patientId" TEXT,
    "responsavelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserAuth_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserAuth_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Responsavel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UserAuth" ("createdAt", "email", "id", "mustChangePassword", "passwordHash", "patientId", "responsavelId", "role", "updatedAt") SELECT "createdAt", "email", "id", "mustChangePassword", "passwordHash", "patientId", "responsavelId", "role", "updatedAt" FROM "UserAuth";
DROP TABLE "UserAuth";
ALTER TABLE "new_UserAuth" RENAME TO "UserAuth";
CREATE UNIQUE INDEX "UserAuth_email_key" ON "UserAuth"("email");
CREATE UNIQUE INDEX "UserAuth_patientId_key" ON "UserAuth"("patientId");
CREATE UNIQUE INDEX "UserAuth_responsavelId_key" ON "UserAuth"("responsavelId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Appointment_doctorId_scheduledAt_idx" ON "Appointment"("doctorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_scheduledAt_idx" ON "Appointment"("patientId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Exam_status_readyAt_idx" ON "Exam"("status", "readyAt");
