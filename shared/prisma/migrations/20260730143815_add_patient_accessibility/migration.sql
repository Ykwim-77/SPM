-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cpf" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "birthDate" DATETIME,
    "address" TEXT,
    "sex" TEXT,
    "motherName" TEXT,
    "fatherName" TEXT,
    "susCard" TEXT,
    "cep" TEXT,
    "cityState" TEXT,
    "nearestUnit" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "substanceUse" TEXT,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "bloodType" TEXT,
    "medicationPhotoRequired" BOOLEAN NOT NULL DEFAULT true,
    "accessibilityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lgpdAccepted" BOOLEAN NOT NULL DEFAULT false,
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "blockedOnline" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Patient" ("active", "address", "allergies", "birthDate", "blockReason", "blockedOnline", "cep", "chronicConditions", "cityState", "cpf", "createdAt", "email", "emergencyContactName", "emergencyContactPhone", "fatherName", "id", "lgpdAccepted", "missedCount", "motherName", "name", "nearestUnit", "phone", "sex", "substanceUse", "susCard", "updatedAt") SELECT "active", "address", "allergies", "birthDate", "blockReason", "blockedOnline", "cep", "chronicConditions", "cityState", "cpf", "createdAt", "email", "emergencyContactName", "emergencyContactPhone", "fatherName", "id", "lgpdAccepted", "missedCount", "motherName", "name", "nearestUnit", "phone", "sex", "substanceUse", "susCard", "updatedAt" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_cpf_key" ON "Patient"("cpf");
CREATE UNIQUE INDEX "Patient_email_key" ON "Patient"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
