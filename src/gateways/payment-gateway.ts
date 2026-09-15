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

  /**
   * `Payment.reference` n'est ni unique ni obligatoire en base : un numéro de reçu
   * ressaisi ne heurte aucune contrainte. C'est ce que le `preview_*` MCP signale.
   */
  findByReference: (schoolId: string, reference: string) =>
    db.payment.findMany({
      where: { schoolId, reference },
      select: { id: true, amount: true, paidAt: true },
      orderBy: { paidAt: 'desc' },
      take: 10,
    }),

  calculateBalance: async (schoolId: string, enrollmentId: string) => {
    const result = await db.payment.aggregate({
      where: { schoolId, enrollmentId },
      _sum: { amount: true },
    })
    return Number(result._sum.amount ?? 0)
  },

  /**
   * Ce que la désactivation des paiements va rendre invisible. Les deux comptages
   * partent ensemble pour que la confirmation énumère, au lieu de laisser
   * l'administrateur deviner.
   */
  countFootprint: async (schoolId: string) => {
    const [payments, pendingTransactions] = await Promise.all([
      db.payment.count({ where: { schoolId } }),
      db.paymentTransaction.count({ where: { schoolId, status: 'PENDING' } }),
    ])

    return { payments, pendingTransactions }
  },
}
