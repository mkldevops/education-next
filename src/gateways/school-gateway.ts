import { db } from '@/lib/db'

/**
 * `School` n'est pas dans `modelsWithIsActive` : le filtre `isActive` est donc
 * explicite ici, afin qu'un futur CRUD d'administration puisse retrouver — et
 * réactiver — une école désactivée.
 */
export const schoolGateway = {
  findActiveById: (id: string) =>
    db.school.findFirst({
      where: { id, isActive: true },
      select: { id: true, name: true, slug: true },
    }),

  listActive: () =>
    db.school.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      // Départage explicite : le repli du contexte doit être déterministe même
      // lorsque plusieurs écoles partagent un createdAt issu d'un backfill.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
}
