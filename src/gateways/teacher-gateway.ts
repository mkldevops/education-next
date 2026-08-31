import { db } from '@/lib/db'

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

  list: (schoolId: string) =>
    db.teacher.findMany({
      where: { schoolId, isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
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
}
