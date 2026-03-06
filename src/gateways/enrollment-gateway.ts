import type { EnrollmentStatus } from '@prisma/client'
import { db } from '@/lib/db'

export const enrollmentGateway = {
  create: (data: {
    studentId: string
    planId: string
    totalAmount: number
    discount?: number
    canLeaveAlone?: boolean
  }) => db.enrollment.create({ data }),

  findById: (id: string) =>
    db.enrollment.findUnique({
      where: { id },
      include: { student: true, plan: true },
    }),

  updateStatus: (id: string, status: EnrollmentStatus) =>
    db.enrollment.update({
      where: { id },
      data: { status },
    }),

  list: () =>
    db.enrollment.findMany({
      where: { isActive: true },
      include: { student: { include: { person: true } }, plan: true },
      orderBy: { registeredAt: 'desc' },
    }),

  findByStudent: (studentId: string) =>
    db.enrollment.findMany({
      where: { studentId },
      include: { plan: true },
    }),

  findDuplicate: async (studentId: string, classPeriodId: string) => {
    const classPeriod = await db.classPeriod.findUnique({
      where: { id: classPeriodId },
      select: { periodId: true },
    })
    if (!classPeriod) return false

    const existing = await db.enrollment.findFirst({
      where: {
        studentId,
        status: { in: ['PENDING', 'ACTIVE'] },
        classAssignments: {
          some: {
            classPeriod: { periodId: classPeriod.periodId },
          },
        },
      },
    })
    return existing !== null
  },

  updateDiscount: (id: string, discount: number, totalAmount: number) =>
    db.enrollment.update({
      where: { id },
      data: { discount, totalAmount },
    }),

  findActiveByFamily: (familyId: string) =>
    db.enrollment.findMany({
      where: {
        status: 'ACTIVE',
        student: {
          person: {
            families: {
              some: { familyId },
            },
          },
        },
      },
      include: { payments: true },
    }),
}
