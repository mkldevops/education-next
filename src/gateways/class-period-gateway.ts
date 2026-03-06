import { db } from '@/lib/db'

export const classPeriodGateway = {
  create: (data: { name: string; capacity: number; levelId: string; periodId: string }) =>
    db.classPeriod.create({ data }),

  update: (
    id: string,
    data: {
      name?: string
      capacity?: number
    }
  ) =>
    db.classPeriod.update({
      where: { id },
      data,
    }),

  findById: (id: string) =>
    db.classPeriod.findUnique({
      where: { id },
      include: { level: true, period: true },
    }),

  list: () =>
    db.classPeriod.findMany({
      where: { isActive: true },
      include: { level: true, period: true },
      orderBy: { name: 'asc' },
    }),

  countEnrolled: async (id: string) => {
    const count = await db.classAssignment.count({
      where: {
        classPeriodId: id,
        endAt: null,
        enrollment: {
          status: { in: ['PENDING', 'ACTIVE'] },
        },
      },
    })
    return count
  },

  findByLevelAndPeriod: (levelId: string, periodId: string) =>
    db.classPeriod.findFirst({
      where: {
        levelId,
        periodId,
        isActive: true,
      },
      include: { level: true, period: true },
    }),
}
