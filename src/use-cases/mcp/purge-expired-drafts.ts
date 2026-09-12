import { committedRetentionBefore, MCP_DRAFT_PURGE_INTERVAL_MINUTES } from '@/domain/mcp-draft'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'

const PURGE_INTERVAL_MS = MCP_DRAFT_PURGE_INTERVAL_MINUTES * 60 * 1000

let lastPurgeAt = 0

/**
 * Entretien opportuniste : le trafic MCP tient l'horloge de la purge.
 *
 * Aucun ordonnanceur n'est déployé avec cette application, et une route de maintenance attendrait un
 * appelant qui n'existe pas. Le trafic MCP est la seule horloge disponible, et c'est exactement le
 * trafic qui crée des brouillons : pas de brouillon sans requête, donc pas de purge inutile.
 *
 * L'état est en mémoire, comme les compteurs de débit de la route : une mise à l'échelle horizontale
 * multiplie les balayages, ce qui est sans conséquence pour un `deleteMany` idempotent.
 */
export async function purgeExpiredDrafts(now: Date = new Date()): Promise<number | 'skipped'> {
  if (now.getTime() - lastPurgeAt < PURGE_INTERVAL_MS) return 'skipped'
  lastPurgeAt = now.getTime()

  return mcpDraftGateway.purgeExpired(now, committedRetentionBefore(now))
}
