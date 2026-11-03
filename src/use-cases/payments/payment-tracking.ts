import { resolveDebtorFamily } from '@/domain/family-debtor'
import {
  paymentInstallments,
  paymentTracking,
  readPaymentSchedule,
  startMonthFromDate,
} from '@/domain/payment-schedule'
import { schoolDayBounds, schoolToday } from '@/domain/school-date'
import { db } from '@/lib/db'
import { roundHalfUp, toNumber } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { PAYABLE_ENROLLMENT_STATUSES } from './family-balance'

export type FamilyPaymentTracking = {
  expectedToDate: number
  overdueAmount: number
  paidToDate: number
  tracked: boolean
}

export type TrackedFamily = FamilyPaymentTracking & { familyId: string; familyName: string }

/**
 * Date-dependent reads share one calculation for the dashboard, family and MCP surfaces.
 * Future-dated payments cannot settle today's deadlines. Amounts remain aggregated in SQL.
 * The last assignment identifies the enrollment's period, including when its seat is closed.
 */
export async function getPaymentTrackingByFamily(
  schoolId: string,
  {
    familyId,
    periodId,
    reference = new Date(),
  }: {
    familyId?: string
    periodId?: string | null
    reference?: Date
  } = {}
): Promise<TrackedFamily[]> {
  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone, reference)
  const { end } = schoolDayBounds(today, timeZone)
  const enrollmentWhere = {
    schoolId,
    isActive: true,
    status: { in: [...PAYABLE_ENROLLMENT_STATUSES] },
    ...(familyId ? { student: { person: { families: { some: { familyId } } } } } : {}),
    ...(periodId ? { classAssignments: { some: { classPeriod: { periodId } } } } : {}),
  }
  const [enrollments, payments] = await Promise.all([
    db.enrollment.findMany({
      where: enrollmentWhere,
      select: {
        id: true,
        totalAmount: true,
        startMonth: true,
        plan: { select: { paymentSchedule: true } },
        classAssignments: {
          orderBy: { startAt: 'desc' },
          take: 1,
          select: { classPeriod: { select: { period: { select: { startAt: true } } } } },
        },
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
    db.payment.groupBy({
      by: ['enrollmentId'],
      where: { schoolId, isActive: true, enrollment: enrollmentWhere, paidAt: { lt: end } },
      _sum: { amount: true },
    }),
  ])
  const paidByEnrollment = new Map(payments.map((row) => [row.enrollmentId, row._sum.amount]))
  const families = new Map<string, TrackedFamily & { creditedPaid: number }>()
  for (const enrollment of enrollments) {
    const debtor = resolveDebtorFamily(enrollment.student.person.families)
    if (!debtor || (familyId && debtor.familyId !== familyId)) continue
    const period = enrollment.classAssignments[0]?.classPeriod.period
    const schedule = readPaymentSchedule(enrollment.plan.paymentSchedule)
    const paid = toNumber(paidByEnrollment.get(enrollment.id) ?? 0)
    const tracking = paymentTracking(
      period
        ? paymentInstallments(
            schedule,
            toNumber(enrollment.totalAmount),
            period.startAt,
            currency,
            startMonthFromDate(enrollment.startMonth)
          )
        : [],
      paid,
      today
    )
    const family = families.get(debtor.familyId) ?? {
      familyId: debtor.familyId,
      familyName: debtor.family.name,
      expectedToDate: 0,
      paidToDate: 0,
      overdueAmount: 0,
      tracked: false,
      creditedPaid: 0,
    }
    family.expectedToDate = roundHalfUp(family.expectedToDate + tracking.expectedToDate)
    family.paidToDate = roundHalfUp(family.paidToDate + paid)
    family.creditedPaid = roundHalfUp(
      family.creditedPaid + Math.min(paid, toNumber(enrollment.totalAmount))
    )
    family.tracked ||= tracking.tracked
    families.set(debtor.familyId, family)
  }
  // Family payments are allocated proportionally, so an advance on one enrollment
  // must also cover another enrollment's elapsed deadlines.
  for (const family of families.values()) {
    family.overdueAmount = Math.max(0, roundHalfUp(family.expectedToDate - family.creditedPaid))
  }
  return [...families.values()]
    .map(({ creditedPaid: _creditedPaid, ...family }) => family)
    .sort((a, b) => b.overdueAmount - a.overdueAmount || a.familyName.localeCompare(b.familyName))
}

export async function getFamilyPaymentTracking(
  schoolId: string,
  familyId: string,
  reference?: Date
): Promise<FamilyPaymentTracking> {
  const rows = await getPaymentTrackingByFamily(schoolId, { familyId, reference })
  const row = rows[0]
  return row
    ? {
        expectedToDate: row.expectedToDate,
        overdueAmount: row.overdueAmount,
        paidToDate: row.paidToDate,
        tracked: row.tracked,
      }
    : { expectedToDate: 0, overdueAmount: 0, paidToDate: 0, tracked: false }
}
