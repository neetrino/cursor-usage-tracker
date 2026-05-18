-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internalUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenLast4" TEXT NOT NULL,
    "computerId" TEXT NOT NULL,
    "owningUser" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "DeviceToken_internalUserId_fkey" FOREIGN KEY ("internalUserId") REFERENCES "InternalUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_tokenHash_key" ON "DeviceToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DeviceToken_internalUserId_idx" ON "DeviceToken"("internalUserId");

-- CreateIndex
CREATE INDEX "DeviceToken_owningUser_computerId_idx" ON "DeviceToken"("owningUser", "computerId");
