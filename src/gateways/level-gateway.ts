import { db } from '@/lib/db'

export const levelGateway = {
  create: (data: { name: string; nextLevelId?: string }) => db.level.create({ data }),

  update: (
    id: string,
    data: {
      name?: string
    }
  ) =>
    db.level.update({
      where: { id },
      data,
    }),

  findById: (id: string) =>
    db.level.findUnique({
      where: { id },
      include: { nextLevel: true },
    }),

  list: () =>
    db.level.findMany({
      where: { isActive: true },
      include: { nextLevel: true },
      orderBy: { name: 'asc' },
    }),

  setNextLevel: (id: string, nextLevelId: string | null) =>
    db.level.update({
      where: { id },
      data: { nextLevelId },
    }),

  findByNextLevelId: (nextLevelId: string) =>
    db.level.findFirst({
      where: { nextLevelId },
      select: { id: true, name: true },
    }),

  countClassPeriods: (id: string) => db.classPeriod.count({ where: { levelId: id } }),

  deactivate: (id: string) =>
    db.$transaction([
      db.level.updateMany({ where: { nextLevelId: id }, data: { nextLevelId: null } }),
      db.level.update({ where: { id }, data: { isActive: false, nextLevelId: null } }),
    ]),
}
