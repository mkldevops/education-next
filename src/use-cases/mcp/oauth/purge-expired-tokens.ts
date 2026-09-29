import { MCP_DRAFT_PURGE_INTERVAL_MINUTES } from '@/domain/mcp-draft'
import { mcpOAuthGrantGateway } from '@/gateways/mcp-oauth-grant-gateway'

const PURGE_INTERVAL_MS = MCP_DRAFT_PURGE_INTERVAL_MINUTES * 60 * 1000

let lastPurgeAt = 0

/**
 * Même horloge que `purgeExpiredDrafts` : le trafic MCP, étranglé par process.
 *
 * Un secret expiré ne sert plus ni à authentifier ni à détecter un rejeu — un code ou un
 * jeton de rafraîchissement rejoué après son expiration est déjà refusé par la date. Les
 * connexions, elles, restent : c'est la liste que l'onglet montre et révoque.
 */
export async function purgeExpiredOAuthTokens(now: Date = new Date()): Promise<number | 'skipped'> {
  if (now.getTime() - lastPurgeAt < PURGE_INTERVAL_MS) return 'skipped'
  lastPurgeAt = now.getTime()

  return mcpOAuthGrantGateway.purgeExpiredTokens(now)
}
