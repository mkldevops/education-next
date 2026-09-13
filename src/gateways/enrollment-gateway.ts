import type { EnrollmentStatus, Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

/** Forme retournée par `findCompletedByPeriod`, consommée par `promote-students`. */
export type CompletedEnrollment = Prisma.EnrollmentGetPayload<{
  include: {
    student: true
    classAssignments: {
      include: {
        classPeriod: {
          include: {
            level: {
              include: { nextLevel: true }
            }
          }
        }
      }
    }
  }
}>

export const enrollmentGateway = {
  create: (
    schoolId: string,
    data: {
      studentId: string
      planId: string
      totalAmount: number
      discount?: number
      canLeaveAlone?: boolean
    }
  ) => db.enrollment.create({ data: { ...data, schoolId } }),

  findById: (schoolId: string, id: string) =>
    db.enrollment.findUnique({
      where: { id_schoolId: { id, schoolId } },
      include: { student: true, plan: true },
    }),

  updateStatus: (schoolId: string, id: string, status: EnrollmentStatus) =>
    db.enrollment.update({
      where: { id_schoolId: { id, schoolId } },
      data: { status },
    }),

  list: (schoolId: string) =>
    db.enrollment.findMany({
      where: { schoolId, isActive: true },
      include: { student: { include: { person: true } }, plan: true },
      orderBy: { registeredAt: 'desc' },
    }),

  findByStudent: (schoolId: string, studentId: string) =>
    db.enrollment.findMany({
      where: { schoolId, studentId },
      include: { plan: true },
    }),

  /**
   * Inscription en cours du même élève sur la **période** de cette classe, paiements actifs
   * comptés : un remplacement ne doit jamais effacer une inscription déjà réglée.
   */
  findActiveInPeriod: async (schoolId: string, studentId: string, classPeriodId: string) => {
    const classPeriod = await db.classPeriod.findUnique({
      where: { id_schoolId: { id: classPeriodId, schoolId } },
      select: { periodId: true },
    })
    if (!classPeriod) return null

    return db.enrollment.findFirst({
      where: {
        schoolId,
        studentId,
        status: { in: ['PENDING', 'ACTIVE'] },
        classAssignments: {
          some: {
            classPeriod: { periodId: classPeriod.periodId },
          },
        },
      },
      select: {
        id: true,
        status: true,
        _count: { select: { payments: { where: { isActive: true } } } },
      },
    })
  },

  updateDiscount: (schoolId: string, id: string, discount: number, totalAmount: number) =>
    db.enrollment.update({
      where: { id_schoolId: { id, schoolId } },
      data: { discount, totalAmount },
    }),

  findPayableByFamily: (schoolId: string, familyId: string) =>
    db.enrollment.findMany({
      where: {
        schoolId,
        status: { in: ['PENDING', 'ACTIVE'] },
        student: {
          person: {
            families: {
              some: { familyId },
            },
          },
        },
      },
      include: { payments: { where: { isActive: true } } },
      orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
    }),

  findEnrolledStudentIds: async (schoolId: string, periodId: string, studentIds: string[]) => {
    if (studentIds.length === 0) return new Set<string>()

    const enrollments = await db.enrollment.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] },
        classAssignments: { some: { classPeriod: { periodId } } },
      },
      select: { studentId: true },
    })
    return new Set(enrollments.map((enrollment) => enrollment.studentId))
  },

  findCompletedByPeriod: async (
    schoolId: string,
    periodId: string
  ): Promise<CompletedEnrollment[]> => {
    const enrollments = await db.enrollment.findMany({
      where: {
        schoolId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        classAssignments: {
          some: {
            classPeriod: { periodId },
          },
        },
      },
      include: {
        student: true,
        classAssignments: {
          where: {
            classPeriod: { periodId },
          },
          include: {
            classPeriod: {
              include: {
                level: {
                  include: { nextLevel: true },
                },
              },
            },
          },
        },
      },
    })
    return enrollments
  },
}
