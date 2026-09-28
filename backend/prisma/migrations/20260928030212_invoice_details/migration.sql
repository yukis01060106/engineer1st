-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Engagement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "monthlyRate" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT '稼働中',
    "settlementMin" INTEGER NOT NULL DEFAULT 140,
    "settlementMax" INTEGER NOT NULL DEFAULT 180,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "settlementMethod" TEXT NOT NULL DEFAULT 'updown',
    "unitRounding" INTEGER NOT NULL DEFAULT 1,
    "hoursUnitMinutes" INTEGER NOT NULL DEFAULT 1,
    "billingName" TEXT,
    CONSTRAINT "Engagement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Engagement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Engagement" ("endDate", "id", "monthlyRate", "paymentTermDays", "projectId", "settlementMax", "settlementMin", "startDate", "status", "userId") SELECT "endDate", "id", "monthlyRate", "paymentTermDays", "projectId", "settlementMax", "settlementMin", "startDate", "status", "userId" FROM "Engagement";
DROP TABLE "Engagement";
ALTER TABLE "new_Engagement" RENAME TO "Engagement";
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engagementId" TEXT NOT NULL,
    "targetMonth" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "workHours" REAL,
    "settledHours" REAL,
    "adjustment" INTEGER NOT NULL DEFAULT 0,
    "hourlyUnit" INTEGER NOT NULL DEFAULT 0,
    "settlementNote" TEXT,
    "withholding" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "taxRate" INTEGER NOT NULL DEFAULT 10,
    "taxAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "issuerInfo" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT '発行済み',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("adjustment", "amount", "baseAmount", "dueDate", "engagementId", "id", "invoiceNumber", "issuedAt", "paidAt", "registrationNumber", "status", "targetMonth", "taxAmount", "taxRate", "totalAmount", "withholding", "workHours") SELECT "adjustment", "amount", "baseAmount", "dueDate", "engagementId", "id", "invoiceNumber", "issuedAt", "paidAt", "registrationNumber", "status", "targetMonth", "taxAmount", "taxRate", "totalAmount", "withholding", "workHours" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "invoiceRegistrationNumber" TEXT,
    "billingProfile" TEXT NOT NULL DEFAULT '{}',
    "workStyle" TEXT NOT NULL DEFAULT 'freelance',
    "role" TEXT NOT NULL DEFAULT 'member',
    "interests" TEXT NOT NULL DEFAULT '[]',
    "signupSource" TEXT,
    "referredById" TEXT,
    "birthYear" INTEGER,
    "lastCheckupDate" DATETIME,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("birthYear", "createdAt", "email", "id", "interests", "invoiceRegistrationNumber", "joinedAt", "lastCheckupDate", "name", "passwordHash", "referredById", "role", "signupSource", "workStyle") SELECT "birthYear", "createdAt", "email", "id", "interests", "invoiceRegistrationNumber", "joinedAt", "lastCheckupDate", "name", "passwordHash", "referredById", "role", "signupSource", "workStyle" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
