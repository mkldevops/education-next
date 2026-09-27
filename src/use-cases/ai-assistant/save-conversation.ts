import type { UIMessage } from 'ai'
import { z } from 'zod'
import { aiConversationGateway } from '@/gateways/ai-conversation-gateway'
import type { Prisma } from '@/generated/prisma/client'

const TITLE_MAX = 80

export const conversationIdSchema = z.uuid()

/**
 * Les photos ne sont pas conservées : chacune devient un texte qui dit qu'il y en avait
 * une. Rouvrir la conversation la montre donc sans l'image, et le modèle sait qu'elle a
 * existé sans pouvoir la relire.
 */
export function withoutImages(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) =>
      part.type === 'file'
        ? { type: 'text' as const, text: `[photo: ${part.filename ?? 'image'}]` }
        : part
    ),
  }))
}

export function conversationTitle(messages: UIMessage[]) {
  const firstUser = messages.find((message) => message.role === 'user')
  const text = firstUser?.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return '[photo]'
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text
}

/**
 * Enregistre l'état de la conversation après un tour. Un échec d'écriture ne doit pas
 * casser la réponse déjà rendue : il est journalisé et la conversation reste vivante
 * dans l'onglet.
 */
export async function saveConversation(
  scope: { schoolId: string; userId: string },
  id: unknown,
  messages: UIMessage[],
  gateway = aiConversationGateway
) {
  const parsedId = conversationIdSchema.safeParse(id)
  if (!parsedId.success) return 'invalidId' as const

  const stored = withoutImages(messages)
  try {
    await gateway.save(scope.schoolId, scope.userId, parsedId.data, {
      title: conversationTitle(messages),
      messages: stored as unknown as Prisma.InputJsonValue,
    })
    return 'OK' as const
  } catch (error) {
    console.error('[ai-assistant] conversation not saved:', (error as Error).name)
    return 'saveFailed' as const
  }
}
