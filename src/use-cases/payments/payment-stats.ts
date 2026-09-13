import {
  collectionByMethod,
  type FamilyOutstanding,
  familiesOutstanding,
  type MethodCollection,
  type MonthlyCollection,
  monthlyCollection,
  type PaymentTotals,
  type StatsEnrollment,
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
 * `calculateFamilyBalance`. Chiffres, graphique et relances sortent donc d'une seule lecture,
 * et le total encaissé ne peut pas diverger de la somme des barres du graphique.
 */
export async function getPaymentStats(
  schoolId: string,
  periodId: string | null
): Promise<PaymentStats> {
  const rows = await db.enrollment.findMany({
    where: {
      schoolId,
      isActive: true,
      status: { in: ['PENDING', 'ACTIVE'] },
      ...(periodId ? { classAssignments: { some: { classPeriod: { periodId } } } } : {}),
    },
    select: {
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
      payments: {
        where: { isActive: true },
        select: { amount: true, method: true, paidAt: true, cashedAt: true },
      },
    },
  })

  const enrollments: StatsEnrollment[] = rows.map((row) => ({
    totalAmount: row.totalAmount,
    family: row.student.person.families[0]?.family ?? null,
    payments: row.payments,
  }))
  const payments = enrollments.flatMap((enrollment) => enrollment.payments)

  return {
    totals: summarizePayments(enrollments),
    monthly: monthlyCollection(payments, { months: MONTHS_CHARTED }),
    methods: collectionByMethod(payments),
    families: familiesOutstanding(enrollments, FAMILIES_LISTED),
  }
}
