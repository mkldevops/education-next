import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { acquireAdvisoryLock } from './advisory-lock'

type ClassScheduleSlotData = {
  classPeriodId: string
  weekday: number
  startTime: string
  endTime: string
  description?: string | null
  teacherIds: string[]
}

const slotInclude = {
  classPeriod: { select: { id: true, name: true, periodId: true } },
  teachers: {
    where: { teacher: { isActive: true } },
    include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
  },
} as const

type SaveResult =
  | { status: 'classOverlap' }
  | { status: 'teacherOverlap' }
  | {
      status: 'OK'
      slot: object
      teacherOverlapIds: string[]
    }

async function acquireScheduleLocks(
  tx: Prisma.TransactionClient,
  schoolId: string,
  data: ClassScheduleSlotData,
  id?: string
) {
  const keys = [
    `class:${schoolId}:${data.classPeriodId}:${data.weekday}`,
    ...data.teacherIds.map((teacherId) => `teacher:${schoolId}:${teacherId}:${data.weekday}`),
    ...(id ? [`slot:${schoolId}:${id}`] : []),
  ]

  for (const key of [...new Set(keys)].sort()) {
    await acquireAdvisoryLock(tx, key)
  }
}

async function saveWithOverlapValidation(
  schoolId: string,
  data: ClassScheduleSlotData,
  teacherOverlapAllowed: boolean,
  id?: string
): Promise<SaveResult> {
  return db.$transaction(async (tx) => {
    await acquireScheduleLocks(tx, schoolId, data, id)

    const classOverlaps = await tx.classScheduleSlot.findMany({
      where: {
        schoolId,
        classPeriodId: data.classPeriodId,
        weekday: data.weekday,
        startTime: { lt: data.endTime },
        endTime: { gt: data.startTime },
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    })
    if (classOverlaps.length > 0) return { status: 'classOverlap' } as const

    const teacherOverlaps = await tx.classScheduleSlot.findMany({
      where: {
        schoolId,
        weekday: data.weekday,
        startTime: { lt: data.endTime },
        endTime: { gt: data.startTime },
        teachers: { some: { teacherId: { in: data.teacherIds } } },
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    })
    if (!teacherOverlapAllowed && teacherOverlaps.length > 0) {
      return { status: 'teacherOverlap' } as const
    }

    const { teacherIds, classPeriodId, ...slotData } = data
    const slot = id
      ? await (async () => {
          await tx.classScheduleSlot.update({
            where: { id_schoolId: { id, schoolId } },
            data: slotData,
          })
          await tx.classScheduleSlotTeacher.deleteMany({
            where: { schoolId, classScheduleSlotId: id },
          })
          await tx.classScheduleSlotTeacher.createMany({
            data: teacherIds.map((teacherId) => ({ schoolId, classScheduleSlotId: id, teacherId })),
          })
          return tx.classScheduleSlot.findUniqueOrThrow({
            where: { id_schoolId: { id, schoolId } },
            include: slotInclude,
          })
        })()
      : await tx.classScheduleSlot.create({
          data: {
            ...slotData,
            school: { connect: { id: schoolId } },
            classPeriod: { connect: { id_schoolId: { id: classPeriodId, schoolId } } },
            teachers: {
              createMany: { data: teacherIds.map((teacherId) => ({ teacherId })) },
            },
          },
          include: slotInclude,
        })

    return {
      status: 'OK',
      slot,
      teacherOverlapIds: teacherOverlaps.map((overlap) => overlap.id),
    } as const
  })
}

export const classScheduleGateway = {
  saveWithOverlapValidation,

  delete: (schoolId: string, id: string) =>
    db.classScheduleSlot.delete({ where: { id_schoolId: { id, schoolId } } }),

  findById: (schoolId: string, id: string) =>
    db.classScheduleSlot.findUnique({
      where: { id_schoolId: { id, schoolId } },
      include: slotInclude,
    }),

  listBySchoolAndPeriod: (schoolId: string, periodId: string) =>
    db.classScheduleSlot.findMany({
      where: { schoolId, classPeriod: { periodId } },
      include: slotInclude,
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    }),

  /**
   * Créneaux des seules classes auxquelles les enfants d'une famille sont encore
   * affectés dans la période. `familyId` ne vient jamais d'une entrée facultative :
   * la page parent l'obtient de `requireSchoolScope()` avant cet appel.
   */
  listByFamilyAndPeriod: async (schoolId: string, familyId: string, periodId: string) => {
    const assignments = await db.classAssignment.findMany({
      where: {
        schoolId,
        endAt: null,
        classPeriod: { periodId, isActive: true },
        enrollment: {
          student: {
            isActive: true,
            person: { families: { some: { schoolId, familyId } } },
          },
        },
      },
      select: {
        classPeriodId: true,
        enrollment: {
          select: { student: { select: { person: { select: { name: true, lastname: true } } } } },
        },
      },
    })

    const studentsByClass = new Map<string, string[]>()
    for (const assignment of assignments) {
      const fullName = `${assignment.enrollment.student.person.name} ${assignment.enrollment.student.person.lastname}`
      const students = studentsByClass.get(assignment.classPeriodId) ?? []
      if (!students.includes(fullName)) students.push(fullName)
      studentsByClass.set(assignment.classPeriodId, students)
    }
    if (studentsByClass.size === 0) return []

    const slots = await db.classScheduleSlot.findMany({
      where: {
        schoolId,
        classPeriodId: { in: [...studentsByClass.keys()] },
        classPeriod: { periodId, isActive: true },
      },
      include: slotInclude,
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    })

    return slots.map((slot) => ({
      ...slot,
      students: studentsByClass.get(slot.classPeriodId) ?? [],
    }))
  },

  listPublicBySchoolAndPeriod: (schoolId: string, periodId: string) =>
    db.classScheduleSlot.findMany({
      where: { schoolId, classPeriod: { periodId } },
      select: {
        id: true,
        weekday: true,
        startTime: true,
        endTime: true,
        description: true,
        classPeriod: { select: { id: true, name: true } },
        teachers: {
          where: { teacher: { isActive: true } },
          select: { teacher: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    }),
}
