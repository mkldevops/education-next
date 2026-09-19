import { OPEN_ENROLLMENT_STATUSES } from '@/domain/enrollment'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

const classPeriodInclude = {
  level: true,
  period: true,
  teachers: { where: { teacher: { isActive: true } }, include: { teacher: true } },
} satisfies Prisma.ClassPeriodInclude

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
      levelId?: string
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

      await tx.classScheduleSlotTeacher.deleteMany({
        where: {
          schoolId,
          classScheduleSlot: { classPeriodId: id },
          teacherId: { notIn: teacherIds },
        },
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
        include: classPeriodInclude,
      })
    })
  },

  findById: (schoolId: string, id: string) =>
    db.classPeriod.findUnique({
      where: { id_schoolId: { id, schoolId } },
      include: classPeriodInclude,
    }),

  countEnrolled: (schoolId: string, id: string) =>
    db.classAssignment.count({
      where: {
        schoolId,
        classPeriodId: id,
        endAt: null,
        enrollment: {
          status: { in: [...OPEN_ENROLLMENT_STATUSES] },
        },
      },
    }),

  deactivate: (schoolId: string, id: string) =>
    db.$transaction(async (tx) => {
      const classPeriod = await tx.classPeriod.findUnique({
        where: { id_schoolId: { id, schoolId } },
        select: {
          _count: {
            select: {
              classAssignments: true,
              teachers: true,
              scheduleSlots: true,
              attendanceSessions: true,
            },
          },
        },
      })
      if (!classPeriod) return 'notFound' as const

      const dependencies = Object.values(classPeriod._count).reduce(
        (total, count) => total + count,
        0
      )
      if (dependencies > 0) return 'classInUse' as const

      await tx.classPeriod.update({
        where: { id_schoolId: { id, schoolId } },
        data: { isActive: false },
      })
      return 'OK' as const
    }),

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

  // Contrairement à `findById`/`list`, filtre les enseignants désactivés au lieu de
  // les exclure : c'est la seule lecture qui doit exposer ces affectations, pour que
  // l'admin puisse les désaffecter (#253).
  listInactiveTeacherAssignments: (schoolId: string, classPeriodId: string) =>
    db.classPeriodTeacher.findMany({
      where: { schoolId, classPeriodId, teacher: { isActive: false } },
      include: { teacher: true },
      orderBy: { teacher: { lastName: 'asc' } },
    }),

  // Seul chemin qui retire une ligne `ClassPeriodTeacher` d'un enseignant désactivé :
  // `update` ci-dessus l'épargne délibérément (#252). Le filtre `teacher.isActive:
  // false` est structurel, pas seulement porté par l'UI qui n'expose le bouton que
  // sur une affectation inactive : un appel direct sur un enseignant actif ne
  // supprime rien, `count` reste 0, comme une affectation absente. Le booléen
  // distingue une affectation absente (ou active) d'une suppression réelle, sans
  // lever d'erreur sur un id fourni par le client.
  unassignTeacher: async (schoolId: string, classPeriodId: string, teacherId: string) => {
    return db.$transaction(async (tx) => {
      const { count } = await tx.classPeriodTeacher.deleteMany({
        where: { schoolId, classPeriodId, teacherId, teacher: { isActive: false } },
      })
      if (count === 0) return false

      await tx.classScheduleSlotTeacher.deleteMany({
        where: { schoolId, teacherId, classScheduleSlot: { classPeriodId } },
      })
      return true
    })
  },
}
