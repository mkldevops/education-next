import { db } from '@/lib/db'

export const levelGateway = {
  create: (schoolId: string, data: { name: string; nextLevelId?: string }) =>
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
      include: { nextLevel: true },
    }),

  /** L'unicité du nom ne porte que sur les niveaux actifs (index partiel `isActive`). */
  findActiveByName: (schoolId: string, name: string) =>
    db.level.findFirst({
      where: { schoolId, name, isActive: true },
      select: { id: true },
    }),

  /**
   * Graphe de progression, seule lecture d'ensemble du modèle : `setNextLevel` y cherche
   * un cycle, et n'a besoin que des deux colonnes de l'arête.
   */
  list: (schoolId: string) =>
    db.level.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, nextLevelId: true },
    }),

  setNextLevel: (schoolId: string, id: string, nextLevelId: string | null) =>
    db.level.update({
      where: { id_schoolId: { id, schoolId } },
      data: { nextLevelId },
    }),

  findByNextLevelId: (schoolId: string, nextLevelId: string) =>
    db.level.findFirst({
      where: { schoolId, nextLevelId },
      select: { id: true, name: true },
    }),

  countClassPeriods: (schoolId: string, id: string) =>
    db.classPeriod.count({ where: { schoolId, levelId: id } }),

  // `nextLevelId` porte une FK composite (nextLevelId, schoolId) en onDelete: Restrict :
  // un SetNull automatique n'est plus possible, il faut vider les pointeurs explicitement.
  deactivate: (schoolId: string, id: string) =>
    db.$transaction([
      db.level.updateMany({
        where: { schoolId, nextLevelId: id },
        data: { nextLevelId: null },
      }),
      db.level.update({
        where: { id_schoolId: { id, schoolId } },
        data: { isActive: false, nextLevelId: null },
      }),
    ]),
}
