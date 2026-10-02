import { MCP_DRAFT_PURGE_INTERVAL_MINUTES } from '@/domain/mcp-draft'
import { unusedClientCutoff } from '@/domain/mcp-oauth'
import { mcpOAuthClientGateway } from '@/gateways/mcp-oauth-client-gateway'
import { mcpOAuthGrantGateway } from '@/gateways/mcp-oauth-grant-gateway'

const PURGE_INTERVAL_MS = MCP_DRAFT_PURGE_INTERVAL_MINUTES * 60 * 1000

let lastPurgeAt = 0

type Gateways = {
  grantGw: Pick<typeof mcpOAuthGrantGateway, 'purgeExpiredTokens'>
  clientGw: Pick<typeof mcpOAuthClientGateway, 'purgeUnused'>
}

/**
 * Même horloge que `purgeExpiredDrafts` : le trafic MCP, étranglé par process.
 *
 * Un secret expiré ne sert plus ni à authentifier ni à détecter un rejeu — un code ou un
 * jeton de rafraîchissement rejoué après son expiration est déjà refusé par la date. Les
 * connexions, elles, restent : c'est la liste que l'onglet montre et révoque.
 *
 * L'enregistrement dynamique est anonyme : sans purge, les clients qui n'ont jamais obtenu
 * de connexion s'accumuleraient sans borne, au rythme permis par la limite de débit.
 */
export async function purgeExpiredOAuthTokens(
  now: Date = new Date(),
  { grantGw, clientGw }: Gateways = {
    grantGw: mcpOAuthGrantGateway,
    clientGw: mcpOAuthClientGateway,
  }
): Promise<{ tokens: number; clients: number } | 'skipped'> {
  if (now.getTime() - lastPurgeAt < PURGE_INTERVAL_MS) return 'skipped'
  lastPurgeAt = now.getTime()

  const tokens = await grantGw.purgeExpiredTokens(now)
  const clients = await clientGw.purgeUnused(unusedClientCutoff(now))
  return { tokens, clients }
}
