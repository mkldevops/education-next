-- Un seul propriétaire par brouillon, du genre annoncé — `OAUTH_GRANT` compris, désormais
-- engagé par la migration précédente.
ALTER TABLE "McpDraft" DROP CONSTRAINT "McpDraft_owner_check";
ALTER TABLE "McpDraft" ADD CONSTRAINT "McpDraft_owner_check" CHECK (
  ("ownerKind" = 'MCP_KEY' AND "keyId" IS NOT NULL AND "userId" IS NULL AND "grantId" IS NULL)
  OR ("ownerKind" = 'ADMIN_SESSION' AND "userId" IS NOT NULL AND "keyId" IS NULL AND "grantId" IS NULL)
  OR ("ownerKind" = 'OAUTH_GRANT' AND "grantId" IS NOT NULL AND "keyId" IS NULL AND "userId" IS NULL)
);
