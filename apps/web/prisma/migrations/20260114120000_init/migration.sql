-- CreateTable
CREATE TABLE "CursorAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "owningUser" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "CursorAccount_owningUser_key" ON "CursorAccount"("owningUser");

CREATE TABLE "InternalUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "computerId" TEXT NOT NULL,
    "cursorAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalUser_cursorAccountId_fkey" FOREIGN KEY ("cursorAccountId") REFERENCES "CursorAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InternalUser_userKey_key" ON "InternalUser"("userKey");

CREATE TABLE "LocalAiEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userKey" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "computerId" TEXT NOT NULL,
    "owningUser" TEXT NOT NULL,
    "timestampMs" BIGINT NOT NULL,
    "timestampUtc" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "marker" TEXT NOT NULL,
    "rawLineHash" TEXT NOT NULL,
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocalAiEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InternalUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LocalAiEvent_rawLineHash_key" ON "LocalAiEvent"("rawLineHash");
CREATE INDEX "LocalAiEvent_owningUser_timestampMs_idx" ON "LocalAiEvent"("owningUser", "timestampMs");

CREATE TABLE "CursorUsageEvent" (
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
    "rawJson" TEXT,
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

CREATE UNIQUE INDEX "CursorUsageEvent_rawHash_key" ON "CursorUsageEvent"("rawHash");
CREATE UNIQUE INDEX "CursorUsageEvent_matchedLocalEventId_key" ON "CursorUsageEvent"("matchedLocalEventId");
CREATE INDEX "CursorUsageEvent_owningUser_timestampMs_idx" ON "CursorUsageEvent"("owningUser", "timestampMs");

CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" TEXT
);
