-- CreateEnum
CREATE TYPE "McpDraftStatus" AS ENUM ('PENDING', 'COMMITTED');

-- CreateTable
CREATE TABLE "McpDraft" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "tool" VARCHAR(50) NOT NULL,
    "checksum" VARCHAR(12) NOT NULL,
    "resolved" JSONB NOT NULL,
    "status" "McpDraftStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpDraft_schoolId_idx" ON "McpDraft"("schoolId");

-- CreateIndex
CREATE INDEX "McpDraft_expiresAt_idx" ON "McpDraft"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "McpDraft_id_schoolId_key" ON "McpDraft"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "McpDraft" ADD CONSTRAINT "McpDraft_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
