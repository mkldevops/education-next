import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export const studentGateway = {
  create: (
    schoolId: string,
    data: {
      personId: string
      birthday?: Date | null
      birthplace?: string
      previousSchool?: string
      healthNotes?: string
      snackAuthorization?: boolean
      allergies?: string
    }
  ) => db.student.create({ data: { ...data, schoolId } }),

  update: (schoolId: string, id: string, data: Prisma.StudentUpdateInput) =>
    db.student.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  deactivate: (schoolId: string, id: string) =>
    db.student.update({
      where: { id_schoolId: { id, schoolId } },
      data: { isActive: false },
    }),

  findById: (schoolId: string, id: string) =>
    db.student.findUnique({
      where: { id_schoolId: { id, schoolId } },
      include: { person: true },
    }),

  list: (schoolId: string) =>
    db.student.findMany({
      where: { schoolId, isActive: true },
      include: { person: true },
      orderBy: { createdAt: 'desc' },
    }),

  findByFamily: (schoolId: string, familyId: string) =>
    db.student.findMany({
      where: {
        schoolId,
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

  hasActiveEnrollments: async (schoolId: string, id: string) => {
    const count = await db.enrollment.count({
      where: {
        schoolId,
        studentId: id,
        status: {
          in: ['PENDING', 'ACTIVE'],
        },
      },
    })
    return count > 0
  },
}
