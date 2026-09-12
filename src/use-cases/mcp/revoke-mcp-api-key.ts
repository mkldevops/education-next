import { z } from 'zod'
import { mcpApiKeyGateway } from '@/gateways/mcp-api-key-gateway'

/**
 * Révocation, jamais suppression : une clé qui a servi doit rester constatable.
 *
 * L'absence de ligne touchée couvre indistinctement la clé inexistante, celle d'un
 * autre porteur et celle déjà révoquée — le porteur n'apprend rien de plus.
 *
 * L'`id` est une valeur de fil, pas une chaîne garantie : sans validation, un
 * `{ not: '' }` passerait en filtre Prisma et révoquerait toutes les clés du porteur.
 */
export async function revokeMcpApiKey(
  id: string,
  userId: string,
  schoolId: string,
  keyGw: Pick<typeof mcpApiKeyGateway, 'revoke'> = mcpApiKeyGateway
) {
  if (!z.uuid().safeParse(id).success) return 'notFound' as const

  const { count } = await keyGw.revoke(id, userId, schoolId, new Date())

  return count === 0 ? ('notFound' as const) : ('OK' as const)
}
