import { db } from '@/lib/db'
import { inSerializableTransaction } from '@/lib/serializable-transaction'

export type TeacherData = {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
}

export type UpdateTeacherData = Partial<TeacherData>

export type TeacherExpenseData = {
  teacherId: string
  amount: number
  category: string
  description: string
  requestedAt: Date
  paidAt?: Date | null
}

export const teacherGateway = {
  create: (schoolId: string, data: TeacherData) =>
    db.teacher.create({ data: { ...data, schoolId } }),

  update: (schoolId: string, id: string, data: UpdateTeacherData) =>
    db.teacher.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  findById: (schoolId: string, id: string) =>
    db.teacher.findUnique({
      where: { id_schoolId: { id, schoolId } },
    }),

  findByIds: (schoolId: string, ids: string[]) =>
    db.teacher.findMany({
      where: { schoolId, id: { in: ids }, isActive: true },
      select: { id: true },
    }),

  createExpense: (schoolId: string, data: TeacherExpenseData) =>
    db.teacherExpense.create({
      data: { ...data, schoolId },
      include: { teacher: true },
    }),

  listExpenses: (schoolId: string) =>
    db.teacherExpense.findMany({
      where: { schoolId, isActive: true },
      include: { teacher: true },
      orderBy: { requestedAt: 'desc' },
    }),

  archive: (schoolId: string, teacherId: string) =>
    inSerializableTransaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({
        where: { id_schoolId: { id: teacherId, schoolId } },
        select: { userId: true },
      })
      if (!teacher) return 'notFound' as const

      if (teacher.userId) {
        const member = await tx.schoolMember.findUnique({
          where: { userId_schoolId: { userId: teacher.userId, schoolId } },
          select: { role: true },
        })
        if (member?.role === 'TEACHER') {
          await tx.userFamily.deleteMany({ where: { userId: teacher.userId, schoolId } })
          await tx.schoolMember.delete({
            where: { userId_schoolId: { userId: teacher.userId, schoolId } },
          })
        }
      }

      await tx.teacher.update({
        where: { id_schoolId: { id: teacherId, schoolId } },
        data: { isActive: false, userId: null },
      })
      return 'OK' as const
    }),

  delete: (schoolId: string, teacherId: string) =>
    inSerializableTransaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({
        where: { id_schoolId: { id: teacherId, schoolId } },
        select: {
          userId: true,
          _count: {
            select: {
              classPeriods: true,
              scheduleSlots: true,
              expenses: true,
              invitations: true,
            },
          },
        },
      })
      if (!teacher) return 'notFound' as const

      const dependencies = Object.values(teacher._count).reduce(
        (total, count) => total + count,
        teacher.userId ? 1 : 0
      )
      if (dependencies > 0) return 'teacherInUse' as const

      await tx.teacher.delete({ where: { id_schoolId: { id: teacherId, schoolId } } })
      return 'OK' as const
    }),

  /**
   * Ce que la désactivation des notes de frais va rendre inatteignable. Rien n'est
   * supprimé : la confirmation énumère pour que l'administrateur décide en connaissance.
   */
  countExpenses: (schoolId: string) => db.teacherExpense.count({ where: { schoolId } }),

  /**
   * Retire uniquement la capacité enseignant d'une fiche de l'école demandée.
   * Un ADMIN/PARENT conserve son `SchoolMember`; un TEACHER-only perd aussi cette
   * appartenance pour ne pas garder un compte sans capacité dans l'école.
   */
  revokeUserAccess: (schoolId: string, teacherId: string) =>
    inSerializableTransaction(async (tx) => {
      const teacher = await tx.teacher.findUnique({
        where: { id_schoolId: { id: teacherId, schoolId } },
        select: { userId: true },
      })
      if (!teacher) return 'notFound' as const
      if (!teacher.userId) return 'alreadyUnlinked' as const

      const member = await tx.schoolMember.findUnique({
        where: { userId_schoolId: { userId: teacher.userId, schoolId } },
        select: { role: true },
      })

      await tx.teacher.update({
        where: { id_schoolId: { id: teacherId, schoolId } },
        data: { userId: null },
      })

      if (member?.role === 'TEACHER') {
        await tx.userFamily.deleteMany({ where: { userId: teacher.userId, schoolId } })
        await tx.schoolMember.delete({
          where: { userId_schoolId: { userId: teacher.userId, schoolId } },
        })
      }

      return 'OK' as const
    }),
}
