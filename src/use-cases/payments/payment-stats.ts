import { resolveDebtorFamily } from '@/domain/family-debtor'
import {
  collectionByMethod,
  type FamilyOutstanding,
  familiesOutstanding,
  type MethodCollection,
  type PaymentTotals,
  summarizePayments,
} from '@/domain/payment-stats'
import { db } from '@/lib/db'
import { roundHalfUp } from '@/lib/decimal'
import {
  type FamilyPaymentTracking,
  getPaymentTrackingByFamily,
  type TrackedFamily,
} from './payment-tracking'

const FAMILIES_LISTED = 6

export type PaymentStats = {
  totals: PaymentTotals
  methods: MethodCollection[]
  families: FamilyToFollowUp[]
  tracking: FamilyPaymentTracking
  overdueFamilies: Array<TrackedFamily & { contactPhone: string | null }>
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

/** Périmètre de la dette : inscriptions `PENDING` et `ACTIVE`, bornées à la période choisie. */
export function paymentScope(schoolId: string, periodId: string | null) {
  const enrollmentWhere = {
    schoolId,
    isActive: true,
    status: { in: ['PENDING' as const, 'ACTIVE' as const] },
    ...(periodId ? { classAssignments: { some: { classPeriod: { periodId } } } } : {}),
  }
  return {
    enrollmentWhere,
    paymentWhere: { schoolId, isActive: true, enrollment: enrollmentWhere },
  }
}

/**
 * Statistiques d'encaissement d'une école, sur la période sélectionnée.
 *
 * Le périmètre est celui de la dette : inscriptions `PENDING` et `ACTIVE`, comme
 * `calculateFamilyBalance`. Les paiements sont agrégés en base ; le graphique a son propre chargeur,
 * `getCollectionSeries`.
 */
export async function getPaymentStats(
  schoolId: string,
  periodId: string | null,
  reference: Date = new Date()
): Promise<PaymentStats> {
  const { enrollmentWhere, paymentWhere } = paymentScope(schoolId, periodId)

  const [rows, paidByEnrollment, byMethod, uncashed, tracking] = await Promise.all([
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
    getPaymentTrackingByFamily(schoolId, { periodId, reference }),
  ])

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
  const overdueFamilies = tracking
    .filter((family) => family.overdueAmount > 0)
    .slice(0, FAMILIES_LISTED)
  const phones = await contactPhones(schoolId, [
    ...new Set([...outstanding, ...overdueFamilies].map((family) => family.familyId)),
  ])

  return {
    totals: summarizePayments(enrollments, methods, {
      amount: uncashed._sum.amount,
      count: uncashed._count._all,
    }),
    methods: collectionByMethod(methods),
    families: outstanding.map((family) => ({
      ...family,
      contactPhone: phones.get(family.familyId) ?? null,
    })),
    tracking: {
      expectedToDate: roundHalfUp(tracking.reduce((sum, family) => sum + family.expectedToDate, 0)),
      overdueAmount: roundHalfUp(tracking.reduce((sum, family) => sum + family.overdueAmount, 0)),
      paidToDate: roundHalfUp(tracking.reduce((sum, family) => sum + family.paidToDate, 0)),
      tracked: tracking.some((family) => family.tracked),
    },
    overdueFamilies: overdueFamilies.map((family) => ({
      ...family,
      contactPhone: phones.get(family.familyId) ?? null,
    })),
  }
}
