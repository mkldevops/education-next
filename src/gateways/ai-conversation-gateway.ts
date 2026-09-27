import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

/**
 * Seule frontière d'accès à `AiConversation`. Chaque requête porte l'école et
 * l'administrateur : une conversation n'est lisible que par celui qui l'a tenue.
 */
export const aiConversationGateway = {
  list: (schoolId: string, userId: string, take: number) =>
    db.aiConversation.findMany({
      where: { schoolId, userId },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take,
    }),

  find: (schoolId: string, userId: string, id: string) =>
    db.aiConversation.findFirst({
      where: { id, schoolId, userId },
      select: { id: true, title: true, messages: true },
    }),

  /**
   * Met à jour la conversation de cet administrateur, ou la crée. Un identifiant déjà
   * pris par quelqu'un d'autre ne met rien à jour et fait échouer la création sur la clé
   * primaire : l'appelant n'écrase jamais la conversation d'un autre.
   */
  save: async (
    schoolId: string,
    userId: string,
    id: string,
    data: { title: string; messages: Prisma.InputJsonValue }
  ) => {
    const { count } = await db.aiConversation.updateMany({
      where: { id, schoolId, userId },
      data: { messages: data.messages },
    })
    if (count > 0) return
    await db.aiConversation.create({ data: { id, schoolId, userId, ...data } })
  },

  delete: (schoolId: string, userId: string, id: string) =>
    db.aiConversation.deleteMany({ where: { id, schoolId, userId } }),
}
