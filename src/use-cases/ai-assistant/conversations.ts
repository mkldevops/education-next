import type { UIMessage } from 'ai'
import { aiConversationGateway } from '@/gateways/ai-conversation-gateway'
import { conversationIdSchema } from './save-conversation'

type Scope = { schoolId: string; userId: string }

const HISTORY_SIZE = 30

export async function listConversations(scope: Scope, gateway = aiConversationGateway) {
  const rows = await gateway.list(scope.schoolId, scope.userId, HISTORY_SIZE)
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function loadConversation(scope: Scope, id: unknown, gateway = aiConversationGateway) {
  const parsed = conversationIdSchema.safeParse(id)
  if (!parsed.success) return 'notFound' as const

  const row = await gateway.find(scope.schoolId, scope.userId, parsed.data)
  if (!row || !Array.isArray(row.messages)) return 'notFound' as const
  return { id: row.id, messages: row.messages as unknown as UIMessage[] }
}

export async function deleteConversation(
  scope: Scope,
  id: unknown,
  gateway = aiConversationGateway
) {
  const parsed = conversationIdSchema.safeParse(id)
  if (!parsed.success) return 'notFound' as const

  const { count } = await gateway.delete(scope.schoolId, scope.userId, parsed.data)
  return count > 0 ? ('OK' as const) : ('notFound' as const)
}
