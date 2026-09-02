import { db } from '@/lib/db'

export const classPeriodGateway = {
  create: (
    schoolId: string,
    data: {
      name: string
      capacity: number
      levelId: string
      periodId: string
      teacherIds?: string[]
    }
  ) => {
    const { teacherIds = [], ...classData } = data

    return db.classPeriod.create({
      data: {
        ...classData,
        schoolId,
        teachers:
          teacherIds.length > 0
            ? {
                createMany: {
                  data: teacherIds.map((teacherId) => ({ schoolId, teacherId })),
                },
              }
            : undefined,
      },
    })
  },

  update: (
    schoolId: string,
    id: string,
    data: {
      name?: string
      capacity?: number
      teacherIds?: string[]
    }
  ) => {
    const { teacherIds, ...classData } = data

    if (teacherIds === undefined) {
      return db.classPeriod.update({
        where: { id_schoolId: { id, schoolId } },
        data: classData,
      })
    }

    return db.$transaction(async (tx) => {
      await tx.classPeriod.update({
        where: { id_schoolId: { id, schoolId } },
        data: classData,
      })

      await tx.classPeriodTeacher.deleteMany({
        where: { schoolId, classPeriodId: id, teacher: { isActive: true } },
      })

      if (teacherIds.length > 0) {
        await tx.classPeriodTeacher.createMany({
          data: teacherIds.map((teacherId) => ({ schoolId, classPeriodId: id, teacherId })),
        })
      }

      return tx.classPeriod.findUniqueOrThrow({
        where: { id_schoolId: { id, schoolId } },
        include: {
          level: true,
          period: true,
          teachers: { where: { teacher: { isActive: true } }, include: { teacher: true } },
        },
      })
    })
  },

  findById: (schoolId: string, id: string) =>
    db.classPeriod.findUnique({
      where: { id_schoolId: { id, schoolId } },
      include: {
        level: true,
        period: true,
        teachers: { where: { teacher: { isActive: true } }, include: { teacher: true } },
      },
    }),

  list: (schoolId: string) =>
    db.classPeriod.findMany({
      where: { schoolId, isActive: true },
      include: {
        level: true,
        period: true,
        teachers: { where: { teacher: { isActive: true } }, include: { teacher: true } },
      },
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
