import { db } from '@/lib/db'

export const planGateway = {
  create: (data: { name: string; amount: number }) => db.plan.create({ data }),

  update: (
    id: string,
    data: {
      name?: string
      amount?: number
    }
  ) =>
    db.plan.update({
      where: { id },
      data,
    }),

  findById: (id: string) =>
    db.plan.findUnique({
      where: { id },
    }),

  list: () =>
    db.plan.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
}
