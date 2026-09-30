import { db } from '@/lib/db'

const clientSelect = { id: true, clientName: true, redirectUris: true, createdAt: true } as const

/**
 * Seule frontière de `McpOAuthClient`.
 *
 * Hors garde tenant par nature : un client s'enregistre avant tout utilisateur et avant
 * toute école. Il ne porte aucun secret — la preuve d'un client public est PKCE — donc
 * rien ici n'est à hacher.
 */
export const mcpOAuthClientGateway = {
  create: (data: { clientName: string; redirectUris: string[] }) =>
    db.mcpOAuthClient.create({ data, select: clientSelect }),

  findById: (id: string) => db.mcpOAuthClient.findUnique({ where: { id }, select: clientSelect }),
}
