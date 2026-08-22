import type { PaymentMethod } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export const paymentGateway = {
  create: (
    schoolId: string,
    data: {
      familyId: string
      enrollmentId: string
      amount: number
      method: PaymentMethod
      reference?: string
      paidAt: Date
      cashedAt?: Date
    }
  ) => db.payment.create({ data: { ...data, schoolId } }),

  createInTransaction: (
    schoolId: string,
    payments: Array<{
      familyId: string
      enrollmentId: string
      amount: number
      method: PaymentMethod
      reference?: string
      paidAt: Date
      cashedAt?: Date
    }>
  ) => db.$transaction(payments.map((data) => db.payment.create({ data: { ...data, schoolId } }))),

  listByFamily: (schoolId: string, familyId: string) =>
    db.payment.findMany({
      where: { schoolId, familyId },
      include: { enrollment: true },
      orderBy: { paidAt: 'desc' },
    }),

  listByEnrollment: (schoolId: string, enrollmentId: string) =>
    db.payment.findMany({
      where: { schoolId, enrollmentId },
      orderBy: { paidAt: 'desc' },
    }),

  list: (schoolId: string) =>
    db.payment.findMany({
      where: { schoolId, enrollment: { isActive: true } },
      include: { enrollment: true },
      orderBy: { paidAt: 'desc' },
    }),

  calculateBalance: async (schoolId: string, enrollmentId: string) => {
    const result = await db.payment.aggregate({
      where: { schoolId, enrollmentId },
      _sum: { amount: true },
    })
    return Number(result._sum.amount ?? 0)
  },
}
