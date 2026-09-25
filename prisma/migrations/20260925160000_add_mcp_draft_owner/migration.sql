-- CreateEnum
CREATE TYPE "McpDraftOwnerKind" AS ENUM ('MCP_KEY', 'ADMIN_SESSION');

-- AlterTable : les brouillons existants appartiennent tous à une clé MCP.
ALTER TABLE "McpDraft" ADD COLUMN "ownerKind" "McpDraftOwnerKind" NOT NULL DEFAULT 'MCP_KEY';
ALTER TABLE "McpDraft" ADD COLUMN "userId" TEXT;
ALTER TABLE "McpDraft" ALTER COLUMN "keyId" DROP NOT NULL;

-- Un seul propriétaire par brouillon, du genre annoncé.
ALTER TABLE "McpDraft" ADD CONSTRAINT "McpDraft_owner_check" CHECK (
  ("ownerKind" = 'MCP_KEY' AND "keyId" IS NOT NULL AND "userId" IS NULL)
  OR ("ownerKind" = 'ADMIN_SESSION' AND "userId" IS NOT NULL AND "keyId" IS NULL)
);

-- Le défaut n'a servi qu'au remplissage : le schéma Prisma exige un genre explicite.
ALTER TABLE "McpDraft" ALTER COLUMN "ownerKind" DROP DEFAULT;
