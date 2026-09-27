-- AlterTable
ALTER TABLE "EventApplication" ADD COLUMN "level" TEXT;
ALTER TABLE "EventApplication" ADD COLUMN "purpose" TEXT;
ALTER TABLE "EventApplication" ADD COLUMN "question" TEXT;

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "catchphrase" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "photo" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "ClubMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "steps" INTEGER,
    "sleepHours" REAL,
    "exerciseMin" INTEGER,
    "mood" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WealthPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "monthlyLivingCost" INTEGER NOT NULL DEFAULT 250000,
    "cashSavings" INTEGER NOT NULL DEFAULT 0,
    "investedAssets" INTEGER NOT NULL DEFAULT 0,
    "kyosaiMonthly" INTEGER NOT NULL DEFAULT 0,
    "idecoMonthly" INTEGER NOT NULL DEFAULT 0,
    "nisaMonthly" INTEGER NOT NULL DEFAULT 0,
    "expectedReturn" REAL NOT NULL DEFAULT 0.03,
    "retireAge" INTEGER NOT NULL DEFAULT 65,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WealthPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FpMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FpMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    CONSTRAINT "Engagement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Engagement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Engagement" ("endDate", "id", "monthlyRate", "projectId", "startDate", "status", "userId") SELECT "endDate", "id", "monthlyRate", "projectId", "startDate", "status", "userId" FROM "Engagement";
DROP TABLE "Engagement";
ALTER TABLE "new_Engagement" RENAME TO "Engagement";
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 90,
    "location" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "joinUrl" TEXT,
    "speaker" TEXT,
    "tags" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 50,
    "clubId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("capacity", "date", "description", "id", "location", "title", "type") SELECT "capacity", "date", "description", "id", "location", "title", "type" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "engagementId" TEXT NOT NULL,
    "targetMonth" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "workHours" REAL,
    "adjustment" INTEGER NOT NULL DEFAULT 0,
    "withholding" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "taxRate" INTEGER NOT NULL DEFAULT 10,
    "taxAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '発行済み',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amount", "engagementId", "id", "invoiceNumber", "issuedAt", "registrationNumber", "status", "targetMonth", "taxAmount", "taxRate", "totalAmount") SELECT "amount", "engagementId", "id", "invoiceNumber", "issuedAt", "registrationNumber", "status", "targetMonth", "taxAmount", "taxRate", "totalAmount" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "invoiceRegistrationNumber" TEXT,
    "workStyle" TEXT NOT NULL DEFAULT 'freelance',
    "role" TEXT NOT NULL DEFAULT 'member',
    "interests" TEXT NOT NULL DEFAULT '[]',
    "signupSource" TEXT,
    "birthYear" INTEGER,
    "lastCheckupDate" DATETIME,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "invoiceRegistrationNumber", "joinedAt", "name", "passwordHash") SELECT "createdAt", "email", "id", "invoiceRegistrationNumber", "joinedAt", "name", "passwordHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMembership_userId_clubId_key" ON "ClubMembership"("userId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthLog_userId_date_key" ON "HealthLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WealthPlan_userId_key" ON "WealthPlan"("userId");
