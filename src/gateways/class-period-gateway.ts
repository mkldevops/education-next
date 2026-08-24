import { db } from '@/lib/db'

export const classPeriodGateway = {
  create: (
    schoolId: string,
    data: { name: string; capacity: number; levelId: string; periodId: string }
  ) => db.classPeriod.create({ data: { ...data, schoolId } }),

  update: (
    schoolId: string,
    id: string,
    data: {
      name?: string
      capacity?: number
    }
  ) =>
    db.classPeriod.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  findById: (schoolId: string, id: string) =>
    db.classPeriod.findUnique({
      where: { id_schoolId: { id, schoolId } },
      include: { level: true, period: true },
    }),

  list: (schoolId: string) =>
    db.classPeriod.findMany({
      where: { schoolId, isActive: true },
      include: { level: true, period: true },
      orderBy: { name: 'asc' },
    }),

  countEnrolled: async (schoolId: string, id: string) => {
    const count = await db.classAssignment.count({
      where: {
        schoolId,
        classPeriodId: id,
        endAt: null,
        enrollment: {
          status: { in: ['PENDING', 'ACTIVE'] },
        },
      },
    })
    return count
  },

  findByLevelAndPeriod: (schoolId: string, levelId: string, periodId: string) =>
    db.classPeriod.findFirst({
      where: {
        schoolId,
        levelId,
        periodId,
        isActive: true,
      },
      include: { level: true, period: true },
    }),
}
