-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Club" (
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
    "status" TEXT NOT NULL DEFAULT 'open',
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Club" ("catchphrase", "color", "description", "id", "level", "name", "photo", "place", "schedule", "slug", "sortOrder") SELECT "catchphrase", "color", "description", "id", "level", "name", "photo", "place", "schedule", "slug", "sortOrder" FROM "Club";
DROP TABLE "Club";
ALTER TABLE "new_Club" RENAME TO "Club";
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
