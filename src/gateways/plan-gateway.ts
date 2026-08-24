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

  list: (schoolId: string) =>
    db.plan.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: 'asc' },
    }),
}
