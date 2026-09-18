import {
  collectionByMethod,
  type FamilyOutstanding,
  familiesOutstanding,
  type MethodCollection,
  type MonthlyCollection,
  monthlyCollection,
  monthWindow,
  nextMonthStart,
  type PaymentTotals,
  summarizePayments,
} from '@/domain/payment-stats'
import { db } from '@/lib/db'

const MONTHS_CHARTED = 12
const FAMILIES_LISTED = 6

export type PaymentStats = {
  totals: PaymentTotals
  monthly: MonthlyCollection[]
  methods: MethodCollection[]
  families: FamilyOutstanding[]
}

/**
 * Statistiques d'encaissement d'une école, sur la période sélectionnée.
 *
 * Le périmètre est celui de la dette : inscriptions `PENDING` et `ACTIVE`, comme
 * `calculateFamilyBalance`. Les paiements sont agrégés en base : seul le graphique lit des lignes,
 * bornées à sa fenêtre, pour que le coût ne croisse pas avec l'historique de l'école.
 */
export async function getPaymentStats(
  schoolId: string,
  periodId: string | null,
  reference: Date = new Date()
): Promise<PaymentStats> {
  const enrollmentWhere = {
    schoolId,
    isActive: true,
    status: { in: ['PENDING' as const, 'ACTIVE' as const] },
    ...(periodId ? { classAssignments: { some: { classPeriod: { periodId } } } } : {}),
  }
  const paymentWhere = { schoolId, isActive: true, enrollment: enrollmentWhere }

  const [rows, paidByEnrollment, byMethod, uncashed, latest] = await Promise.all([
    db.enrollment.findMany({
      where: enrollmentWhere,
      select: {
        id: true,
        totalAmount: true,
        student: {
          select: {
            person: {
              select: {
                families: {
                  select: { family: { select: { id: true, name: true } } },
                  orderBy: { familyId: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
    db.payment.groupBy({ by: ['enrollmentId'], where: paymentWhere, _sum: { amount: true } }),
    db.payment.groupBy({
      by: ['method'],
      where: paymentWhere,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.payment.aggregate({
      where: { ...paymentWhere, method: 'CHECK', cashedAt: null },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.payment.aggregate({
      where: { ...paymentWhere, paidAt: { lt: nextMonthStart(reference) } },
      _max: { paidAt: true },
    }),
  ])

  const window = monthWindow(latest._max.paidAt, { months: MONTHS_CHARTED, reference })
  const charted = await db.payment.findMany({
    where: { ...paymentWhere, paidAt: { gte: window.from, lt: window.to } },
    select: { amount: true, paidAt: true },
  })

  const paid = new Map(paidByEnrollment.map((row) => [row.enrollmentId, row._sum.amount]))
  const enrollments = rows.map((row) => ({
    totalAmount: row.totalAmount,
    paid: paid.get(row.id) ?? null,
    family: row.student.person.families[0]?.family ?? null,
  }))
  const methods = byMethod.map((row) => ({
    method: row.method,
    amount: row._sum.amount,
    count: row._count._all,
  }))

  return {
    totals: summarizePayments(enrollments, methods, {
      amount: uncashed._sum.amount,
      count: uncashed._count._all,
    }),
    monthly: monthlyCollection(charted, window),
    methods: collectionByMethod(methods),
    families: familiesOutstanding(enrollments, FAMILIES_LISTED),
  }
}
