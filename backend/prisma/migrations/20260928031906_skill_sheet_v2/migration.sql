-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SkillSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "skills" TEXT NOT NULL,
    "experiences" TEXT NOT NULL,
    "age" INTEGER,
    "nearestStation" TEXT,
    "availability" TEXT,
    "desiredRate" INTEGER,
    "totalExperienceYears" INTEGER,
    "workProcesses" TEXT,
    "appealPoints" TEXT,
    "remarks" TEXT,
    "initials" TEXT,
    "showFullName" BOOLEAN NOT NULL DEFAULT false,
    "gender" TEXT,
    "specialty" TEXT,
    "qualifications" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillSheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SkillSheet" ("age", "appealPoints", "availability", "desiredRate", "experiences", "id", "nearestStation", "remarks", "skills", "summary", "totalExperienceYears", "updatedAt", "userId", "workProcesses") SELECT "age", "appealPoints", "availability", "desiredRate", "experiences", "id", "nearestStation", "remarks", "skills", "summary", "totalExperienceYears", "updatedAt", "userId", "workProcesses" FROM "SkillSheet";
DROP TABLE "SkillSheet";
ALTER TABLE "new_SkillSheet" RENAME TO "SkillSheet";
CREATE UNIQUE INDEX "SkillSheet_userId_key" ON "SkillSheet"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
