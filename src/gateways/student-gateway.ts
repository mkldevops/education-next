import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export const studentGateway = {
  create: (data: {
    personId: string
    birthday: Date
    birthplace?: string
    previousSchool?: string
    healthNotes?: string
    languagesAtHome?: Prisma.InputJsonValue
    snackAuthorization?: boolean
    allergies?: string
  }) => db.student.create({ data }),

  update: (id: string, data: Record<string, unknown>) =>
    db.student.update({
      where: { id },
      data,
    }),

  deactivate: (id: string) =>
    db.student.update({
      where: { id },
      data: { isActive: false },
    }),

  findById: (id: string) =>
    db.student.findUnique({
      where: { id },
      include: { person: true },
    }),

  list: () =>
    db.student.findMany({
      include: { person: true },
      orderBy: { createdAt: 'desc' },
    }),

  findByFamily: (familyId: string) =>
    db.student.findMany({
      where: {
        person: {
          families: {
            some: {
              familyId,
            },
          },
        },
      },
      include: { person: true },
    }),

  hasActiveEnrollments: async (id: string) => {
    const count = await db.enrollment.count({
      where: {
        studentId: id,
        status: {
          in: ['PENDING', 'ACTIVE'],
        },
      },
    })
    return count > 0
  },
}
