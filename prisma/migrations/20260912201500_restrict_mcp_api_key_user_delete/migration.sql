-- La révocation d'une clé écrit `revokedAt` et ne supprime jamais la ligne. Une FK en
-- CASCADE rendait cette garantie fausse : supprimer le compte porteur effaçait en silence
-- toutes ses clés, révoquées comprises.
-- DropForeignKey
ALTER TABLE "McpApiKey" DROP CONSTRAINT "McpApiKey_userId_fkey";

-- AddForeignKey
ALTER TABLE "McpApiKey" ADD CONSTRAINT "McpApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
