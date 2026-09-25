import type { DraftOwner } from '@/domain/mcp-draft'

/**
 * Ce qu'un `preview_*` ou un `commit_*` a besoin de savoir de son appelant, quel que soit
 * le canal.
 *
 * Le serveur MCP y projette sa `McpScope` ; l'assistant d'inscription y projette la session
 * d'un administrateur d'école. Les use cases n'ont pas à connaître le canal : l'école
 * cantonne les lectures, `userId` signe les créations, `paymentsEnabled` est résolu une fois
 * par l'appelant, et `owner` cantonne les brouillons.
 */
export type DraftScope = {
  schoolId: string
  userId: string
  paymentsEnabled: boolean
  owner: DraftOwner
}
