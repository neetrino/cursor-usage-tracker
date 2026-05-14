/*
  Warnings:

  - You are about to alter the column `rawJson` on the `CursorUsageEvent` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `metadata` on the `SyncRun` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CursorUsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owningUser" TEXT NOT NULL,
    "timestampMs" BIGINT NOT NULL,
    "timestampUtc" DATETIME NOT NULL,
    "model" TEXT NOT NULL,
    "kind" TEXT,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "chargedCents" REAL,
    "requestsCosts" REAL,
    "totalCents" REAL,
    "isChargeable" BOOLEAN,
    "isTokenBasedCall" BOOLEAN,
    "isHeadless" BOOLEAN,
    "rawHash" TEXT NOT NULL,
    "rawJson" JSONB,
    "matchedUserId" TEXT,
    "matchedLocalEventId" TEXT,
    "matchDiffMs" INTEGER,
    "matchConfidence" REAL,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CursorUsageEvent_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "InternalUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CursorUsageEvent_matchedLocalEventId_fkey" FOREIGN KEY ("matchedLocalEventId") REFERENCES "LocalAiEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CursorUsageEvent" ("cacheReadTokens", "chargedCents", "createdAt", "id", "inputTokens", "isChargeable", "isHeadless", "isTokenBasedCall", "kind", "matchConfidence", "matchDiffMs", "matchStatus", "matchedLocalEventId", "matchedUserId", "model", "outputTokens", "owningUser", "rawHash", "rawJson", "requestsCosts", "timestampMs", "timestampUtc", "totalCents", "totalTokens", "updatedAt") SELECT "cacheReadTokens", "chargedCents", "createdAt", "id", "inputTokens", "isChargeable", "isHeadless", "isTokenBasedCall", "kind", "matchConfidence", "matchDiffMs", "matchStatus", "matchedLocalEventId", "matchedUserId", "model", "outputTokens", "owningUser", "rawHash", "rawJson", "requestsCosts", "timestampMs", "timestampUtc", "totalCents", "totalTokens", "updatedAt" FROM "CursorUsageEvent";
DROP TABLE "CursorUsageEvent";
ALTER TABLE "new_CursorUsageEvent" RENAME TO "CursorUsageEvent";
CREATE UNIQUE INDEX "CursorUsageEvent_rawHash_key" ON "CursorUsageEvent"("rawHash");
CREATE UNIQUE INDEX "CursorUsageEvent_matchedLocalEventId_key" ON "CursorUsageEvent"("matchedLocalEventId");
CREATE INDEX "CursorUsageEvent_owningUser_timestampMs_idx" ON "CursorUsageEvent"("owningUser", "timestampMs");
CREATE TABLE "new_SyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB
);
INSERT INTO "new_SyncRun" ("errorMessage", "finishedAt", "id", "importedCount", "metadata", "skippedDuplicateCount", "source", "startedAt", "status") SELECT "errorMessage", "finishedAt", "id", "importedCount", "metadata", "skippedDuplicateCount", "source", "startedAt", "status" FROM "SyncRun";
DROP TABLE "SyncRun";
ALTER TABLE "new_SyncRun" RENAME TO "SyncRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
