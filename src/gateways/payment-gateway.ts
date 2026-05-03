import type { PaymentMethod } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export const paymentGateway = {
  create: (data: {
    familyId: string
    enrollmentId: string
    amount: number
    method: PaymentMethod
    reference?: string
    paidAt: Date
    cashedAt?: Date
  }) => db.payment.create({ data }),

  createInTransaction: (
    payments: Array<{
      familyId: string
      enrollmentId: string
      amount: number
      method: PaymentMethod
      reference?: string
      paidAt: Date
      cashedAt?: Date
    }>
  ) => db.$transaction(payments.map((data) => db.payment.create({ data }))),

  listByFamily: (familyId: string) =>
    db.payment.findMany({
      where: { familyId },
      include: { enrollment: true },
      orderBy: { paidAt: 'desc' },
    }),

  listByEnrollment: (enrollmentId: string) =>
    db.payment.findMany({
      where: { enrollmentId },
      orderBy: { paidAt: 'desc' },
    }),

  list: () =>
    db.payment.findMany({
      where: { enrollment: { isActive: true } },
      include: { enrollment: true },
      orderBy: { paidAt: 'desc' },
    }),

  calculateBalance: async (enrollmentId: string) => {
    const result = await db.payment.aggregate({
      where: { enrollmentId },
      _sum: { amount: true },
    })
    return Number(result._sum.amount ?? 0)
  },
}
