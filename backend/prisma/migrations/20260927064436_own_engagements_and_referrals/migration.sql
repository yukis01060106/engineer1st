-- AlterTable
ALTER TABLE "User" ADD COLUMN "referredById" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "skills" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "workStyle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isListed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Project" ("client", "createdAt", "description", "id", "skills", "title", "unitPrice", "workStyle") SELECT "client", "createdAt", "description", "id", "skills", "title", "unitPrice", "workStyle" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
