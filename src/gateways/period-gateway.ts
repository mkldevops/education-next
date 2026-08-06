import { db } from '@/lib/db'

export const periodGateway = {
  create: (data: { name: string; startAt: Date; endAt: Date }) => db.period.create({ data }),

  update: (
    id: string,
    data: {
      name?: string
      startAt?: Date
      endAt?: Date
    }
  ) =>
    db.period.update({
      where: { id },
      data,
    }),

  findById: (id: string) =>
    db.period.findUnique({
      where: { id },
    }),

  list: () =>
    db.period.findMany({
      where: { isActive: true },
      orderBy: { startAt: 'desc' },
    }),

  checkOverlap: async (startAt: Date, endAt: Date, excludeId?: string) => {
    const periods = await db.period.findMany({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [{ startAt: { lte: endAt }, endAt: { gte: startAt } }],
      },
    })
    return periods.length > 0
  },

  countClassPeriods: (id: string) => db.classPeriod.count({ where: { periodId: id } }),

  deactivate: (id: string) => db.period.update({ where: { id }, data: { isActive: false } }),
}
