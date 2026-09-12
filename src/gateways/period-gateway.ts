import { db } from '@/lib/db'

export const periodGateway = {
  create: (schoolId: string, data: { name: string; startAt: Date; endAt: Date }) =>
    db.period.create({ data: { ...data, schoolId } }),

  update: (
    schoolId: string,
    id: string,
    data: {
      name?: string
      startAt?: Date
      endAt?: Date
    }
  ) =>
    db.period.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  findById: (schoolId: string, id: string) =>
    db.period.findUnique({
      where: { id_schoolId: { id, schoolId } },
    }),

  checkOverlap: async (schoolId: string, startAt: Date, endAt: Date, excludeId?: string) => {
    const periods = await db.period.findMany({
      where: {
        schoolId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [{ startAt: { lte: endAt }, endAt: { gte: startAt } }],
      },
    })
    return periods.length > 0
  },

  countClassPeriods: (schoolId: string, id: string) =>
    db.classPeriod.count({ where: { schoolId, periodId: id } }),

  deactivate: (schoolId: string, id: string) =>
    db.period.update({
      where: { id_schoolId: { id, schoolId } },
      data: { isActive: false },
    }),
}
