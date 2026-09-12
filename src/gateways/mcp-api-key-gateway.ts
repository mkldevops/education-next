import { db } from '@/lib/db'

const listSelect = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const

/**
 * Seule frontière de lecture ET de mutation de `McpApiKey`.
 *
 * Ce modèle est volontairement hors du garde tenant, pour la raison déjà écrite pour
 * `SchoolMember` : la présentation d'une clé se résout par `keyHash` avant qu'une école
 * soit connue. Concentrer ces accès ici est ce qui remplace le garde — aucun autre
 * appelant ne doit atteindre `db.mcpApiKey`.
 *
 * `McpApiKey` n'a pas de colonne `isActive` : une clé révoquée doit rester visible dans
 * la liste de gestion, ce que le filtre de suppression douce interdirait.
 */
export const mcpApiKeyGateway = {
  findByHash: (keyHash: string) =>
    db.mcpApiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        schoolId: true,
        userId: true,
        prefix: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
      },
    }),

  /** Clés d'un utilisateur sur une école, révoquées comprises. */
  listForUser: (userId: string, schoolId: string) =>
    db.mcpApiKey.findMany({
      where: { userId, schoolId },
      select: listSelect,
      // Départage explicite : deux clés créées dans la même milliseconde doivent
      // s'ordonner de façon stable d'un rendu à l'autre.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),

  countLive: (userId: string, schoolId: string, now: Date) =>
    db.mcpApiKey.count({
      where: { userId, schoolId, revokedAt: null, expiresAt: { gt: now } },
    }),

  create: (data: {
    schoolId: string
    userId: string
    name: string
    prefix: string
    keyHash: string
    expiresAt: Date
  }) => db.mcpApiKey.create({ data, select: listSelect }),

  /**
   * Révocation par `updateMany` scopé sur `(id, userId, schoolId)` : une clé d'un autre
   * porteur ou d'une autre école ne doit pas être révocable, et `count === 0` porte ce
   * refus sans révéler que la clé existe.
   */
  revoke: (id: string, userId: string, schoolId: string, now: Date) =>
    db.mcpApiKey.updateMany({
      where: { id, userId, schoolId, revokedAt: null },
      data: { revokedAt: now },
    }),

  /**
   * Horodatage d'usage, écrit hors du chemin de réponse. L'écriture est conditionnée à
   * l'ancienneté de la dernière trace : sans elle, chaque appel d'outil produirait un
   * `UPDATE` sur la même ligne.
   */
  touch: (id: string, now: Date, staleBefore: Date) =>
    db.mcpApiKey.updateMany({
      where: { id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: staleBefore } }] },
      data: { lastUsedAt: now },
    }),
}
