import { z } from 'zod'
import { mcpOAuthGrantGateway } from '@/gateways/mcp-oauth-grant-gateway'

/** Connexions OAuth d'un administrateur sur l'école active, révoquées comprises. */
export async function listMcpOAuthGrants(
  userId: string,
  schoolId: string,
  grantGw: Pick<typeof mcpOAuthGrantGateway, 'listForUser'> = mcpOAuthGrantGateway
) {
  return grantGw.listForUser(userId, schoolId)
}

/**
 * Révocation depuis l'onglet, jamais suppression : mêmes règles que `revokeMcpApiKey`,
 * `id` validé avant de servir de filtre.
 */
export async function revokeMcpOAuthGrant(
  id: string,
  userId: string,
  schoolId: string,
  grantGw: Pick<typeof mcpOAuthGrantGateway, 'revokeForUser'> = mcpOAuthGrantGateway
) {
  if (!z.uuid().safeParse(id).success) return 'notFound' as const

  const { count } = await grantGw.revokeForUser(id, userId, schoolId, new Date())

  return count === 0 ? ('notFound' as const) : ('OK' as const)
}
