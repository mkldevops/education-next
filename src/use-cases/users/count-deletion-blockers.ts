import { mcpApiKeyGateway } from '@/gateways/mcp-api-key-gateway'
import { countRowsBlockingUserDeletion } from '@/lib/db-unscoped'

/**
 * Tout ce qui contraint la clé étrangère d'un compte, en une seule question. Les deux
 * chemins de suppression — administration (`deleteUser`) et libre-service
 * (`deleteProfile`) — doivent compter la même chose, sans quoi l'un refuse proprement
 * ce sur quoi l'autre casse.
 *
 * Les clés machine se comptent par leur propre frontière : `McpApiKey` est hors garde
 * tenant et sans suppression douce, donc le client ordinaire en voit déjà toutes les
 * lignes, et `db-unscoped` n'a pas à gagner une exception de plus.
 */
export async function countUserDeletionBlockers(userId: string): Promise<number> {
  const [platformRows, machineKeys] = await Promise.all([
    countRowsBlockingUserDeletion(userId),
    mcpApiKeyGateway.countForUser(userId),
  ])

  return platformRows + machineKeys
}
