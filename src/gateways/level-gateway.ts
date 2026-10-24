import { db } from '@/lib/db'

export const levelGateway = {
  create: (schoolId: string, data: { name: string }) =>
    db.level.create({ data: { ...data, schoolId } }),

  update: (
    schoolId: string,
    id: string,
    data: {
      name?: string
    }
  ) =>
    db.level.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  findById: (schoolId: string, id: string) =>
    db.level.findUnique({
      where: { id_schoolId: { id, schoolId } },
    }),

  findActiveByIds: (schoolId: string, ids: string[]) =>
    db.level.findMany({ where: { schoolId, id: { in: ids } }, select: { id: true } }),

  /** L'unicité du nom ne porte que sur les niveaux actifs (index partiel `isActive`). */
  findActiveByName: (schoolId: string, name: string) =>
    db.level.findFirst({
      where: { schoolId, name, isActive: true },
      select: { id: true },
    }),

  /**
   * Graphe de progression : `setNextLevels` y cherche un cycle. La désactivation d'un niveau
   * retire ses arêtes, le graphe ne relie donc que des niveaux actifs.
   */
  listProgression: (schoolId: string) =>
    db.levelProgression.findMany({
      where: { schoolId },
      select: { levelId: true, nextLevelId: true },
    }),

  setNextLevels: (schoolId: string, id: string, nextLevelIds: string[]) =>
    db.$transaction([
      db.levelProgression.deleteMany({ where: { schoolId, levelId: id } }),
      db.levelProgression.createMany({
        data: nextLevelIds.map((nextLevelId) => ({ schoolId, levelId: id, nextLevelId })),
      }),
    ]),

  countClassPeriods: (schoolId: string, id: string) =>
    db.classPeriod.count({ where: { schoolId, levelId: id } }),

  // La désactivation est logique : la cascade des arêtes ne joue pas, elles sont retirées ici
  // dans les deux sens pour qu'aucune progression ne mène à un niveau désactivé.
  deactivate: (schoolId: string, id: string) =>
    db.$transaction([
      db.levelProgression.deleteMany({
        where: { schoolId, OR: [{ levelId: id }, { nextLevelId: id }] },
      }),
      db.level.update({
        where: { id_schoolId: { id, schoolId } },
        data: { isActive: false },
      }),
    ]),
}
