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
      include: { nextLevel: true },
      orderBy: { name: 'asc' },
    }),

  setNextLevel: (id: string, nextLevelId: string | null) =>
    db.level.update({
      where: { id },
      data: { nextLevelId },
    }),
}
