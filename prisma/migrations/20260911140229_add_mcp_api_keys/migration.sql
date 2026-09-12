-- CreateTable
CREATE TABLE "McpApiKey" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "prefix" VARCHAR(16) NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpApiKey_keyHash_key" ON "McpApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "McpApiKey_schoolId_idx" ON "McpApiKey"("schoolId");

-- CreateIndex
CREATE INDEX "McpApiKey_userId_schoolId_idx" ON "McpApiKey"("userId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "McpApiKey_id_schoolId_key" ON "McpApiKey"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "McpApiKey" ADD CONSTRAINT "McpApiKey_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpApiKey" ADD CONSTRAINT "McpApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
