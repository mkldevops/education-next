import { resolveDebtorFamily } from '@/domain/family-debtor'
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
  families: FamilyToFollowUp[]
}

/** Famille à relancer, avec le téléphone à composer pour la joindre. */
type FamilyToFollowUp = FamilyOutstanding & { contactPhone: string | null }

const CONTACT_RELATIONS = ['PARENT', 'TUTOR'] as const

/**
 * Téléphone du contact de chaque famille listée : celui d'un parent, sinon d'un tuteur, sinon
 * le contact d'urgence de la fiche. Une seule requête, bornée aux familles affichées.
 */
async function contactPhones(schoolId: string, familyIds: string[]) {
  if (familyIds.length === 0) return new Map<string, string>()

  const families = await db.family.findMany({
    where: { schoolId, id: { in: familyIds } },
    select: {
      id: true,
      emergencyContactPhone: true,
      persons: {
        where: { relationType: { in: [...CONTACT_RELATIONS] }, person: { isActive: true } },
        select: {
          relationType: true,
          person: {
            select: {
              phoneNumbers: {
                where: { isActive: true },
                select: { phoneNumber: true },
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  const phones = new Map<string, string>()
  for (const family of families) {
    const member = CONTACT_RELATIONS.flatMap((relation) =>
      family.persons.filter((person) => person.relationType === relation)
    ).find((person) => person.person.phoneNumbers.length > 0)
    const phone = member?.person.phoneNumbers[0].phoneNumber ?? family.emergencyContactPhone
    if (phone) phones.set(family.id, phone)
  }

  return phones
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
                  select: {
                    familyId: true,
                    relationType: true,
                    family: { select: { id: true, name: true } },
                  },
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
  const paid = new Map(paidByEnrollment.map((row) => [row.enrollmentId, row._sum.amount]))
  const enrollments = rows.map((row) => ({
    totalAmount: row.totalAmount,
    paid: paid.get(row.id) ?? null,
    family: resolveDebtorFamily(row.student.person.families)?.family ?? null,
  }))
  const methods = byMethod.map((row) => ({
    method: row.method,
    amount: row._sum.amount,
    count: row._count._all,
  }))

  const outstanding = familiesOutstanding(enrollments, FAMILIES_LISTED)
  const [charted, phones] = await Promise.all([
    db.payment.findMany({
      where: { ...paymentWhere, paidAt: { gte: window.from, lt: window.to } },
      select: { amount: true, paidAt: true },
    }),
    contactPhones(
      schoolId,
      outstanding.map((family) => family.familyId)
    ),
  ])

  return {
    totals: summarizePayments(enrollments, methods, {
      amount: uncashed._sum.amount,
      count: uncashed._count._all,
    }),
    monthly: monthlyCollection(charted, window),
    methods: collectionByMethod(methods),
    families: outstanding.map((family) => ({
      ...family,
      contactPhone: phones.get(family.familyId) ?? null,
    })),
  }
}
