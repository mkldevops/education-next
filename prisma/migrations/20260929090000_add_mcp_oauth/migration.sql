-- CreateEnum
CREATE TYPE "McpOAuthTokenKind" AS ENUM ('CODE', 'ACCESS', 'REFRESH');

-- AlterEnum : troisième propriétaire de brouillon, la connexion OAuth. La contrainte CHECK
-- qui l'utilise vit dans la migration suivante : PostgreSQL refuse d'employer une valeur
-- d'enum dans la transaction qui l'ajoute.
ALTER TYPE "McpDraftOwnerKind" ADD VALUE 'OAUTH_GRANT';

-- CreateTable
CREATE TABLE "McpOAuthClient" (
    "id" TEXT NOT NULL,
    "clientName" VARCHAR(120) NOT NULL,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpOAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthGrant" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" VARCHAR(120) NOT NULL,
    "resource" VARCHAR(255) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpOAuthGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpOAuthToken" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "kind" "McpOAuthTokenKind" NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "prefix" VARCHAR(16) NOT NULL,
    "codeChallenge" VARCHAR(128),
    "redirectUri" VARCHAR(512),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpOAuthToken_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "McpDraft" ADD COLUMN "grantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthGrant_id_schoolId_key" ON "McpOAuthGrant"("id", "schoolId");
CREATE INDEX "McpOAuthGrant_schoolId_idx" ON "McpOAuthGrant"("schoolId");
CREATE INDEX "McpOAuthGrant_userId_schoolId_idx" ON "McpOAuthGrant"("userId", "schoolId");
CREATE INDEX "McpOAuthGrant_clientId_idx" ON "McpOAuthGrant"("clientId");
CREATE UNIQUE INDEX "McpOAuthToken_tokenHash_key" ON "McpOAuthToken"("tokenHash");
CREATE INDEX "McpOAuthToken_grantId_idx" ON "McpOAuthToken"("grantId");
CREATE INDEX "McpOAuthToken_expiresAt_idx" ON "McpOAuthToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "McpOAuthGrant" ADD CONSTRAINT "McpOAuthGrant_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpOAuthGrant" ADD CONSTRAINT "McpOAuthGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "McpOAuthGrant" ADD CONSTRAINT "McpOAuthGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpOAuthToken" ADD CONSTRAINT "McpOAuthToken_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "McpOAuthGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
