import { db } from '@/lib/db'

export const planGateway = {
  create: (schoolId: string, data: { name: string; amount: number }) =>
    db.plan.create({ data: { ...data, schoolId } }),

  update: (
    schoolId: string,
    id: string,
    data: {
      name?: string
      amount?: number
    }
  ) =>
    db.plan.update({
      where: { id_schoolId: { id, schoolId } },
      data,
    }),

  findById: (schoolId: string, id: string) =>
    db.plan.findUnique({
      where: { id_schoolId: { id, schoolId } },
    }),

  countOpenEnrollments: (schoolId: string, id: string) =>
    db.enrollment.count({ where: { schoolId, planId: id, status: { in: ['PENDING', 'ACTIVE'] } } }),

  deactivate: (schoolId: string, id: string) =>
    db.plan.update({
      where: { id_schoolId: { id, schoolId } },
      data: { isActive: false },
    }),
}
