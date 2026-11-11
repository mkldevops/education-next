import { resolveDebtorFamily } from '@/domain/family-debtor'
import {
  paymentInstallments,
  paymentTracking,
  readPaymentSchedule,
  startMonthFromDate,
} from '@/domain/payment-schedule'
import { nextMonthStart, schoolDayBounds, schoolToday } from '@/domain/school-date'
import { db } from '@/lib/db'
import { roundHalfUp, toNumber } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { PAYABLE_ENROLLMENT_STATUSES } from './family-balance'

export type FamilyPaymentTracking = {
  expectedToDate: number
  overdueAmount: number
  /** Unpaid installments due by the end of the current month, arrears included. */
  dueThisMonth: number
  paidToDate: number
  tracked: boolean
}

export type TrackedFamily = FamilyPaymentTracking & { familyId: string; familyName: string }

/**
 * Annual frame of the same enrollments the deadlines are computed on, so a progress bar and its
 * "expected" marker share one scope. `creditedPaid` caps each enrollment at its own price.
 */
export type FamilyPaymentTrackingDetail = FamilyPaymentTracking & {
  annualAmount: number
  creditedPaid: number
  /** Every payable enrollment has a schedule: the annual frame and the deadlines coincide. */
  fullyScheduled: boolean
}

export type TrackedFamilyDetail = TrackedFamily & FamilyPaymentTrackingDetail

/**
 * Date-dependent reads share one calculation for the dashboard, family and MCP surfaces.
 * Future-dated payments cannot settle today's deadlines. Amounts remain aggregated in SQL.
 * The last assignment identifies the enrollment's period, including when its seat is closed.
 */
export async function getPaymentTrackingByFamily(
  ...args: Parameters<typeof collectFamilyTracking>
): Promise<TrackedFamily[]> {
  return (await collectFamilyTracking(...args)).map(
    ({ annualAmount: _annual, creditedPaid: _credited, fullyScheduled: _full, ...family }) => family
  )
}

/** Suivi de chaque famille avec son cadre annuel, pour le tableau de suivi de l'école. */
export async function getPaymentTrackingDetailByFamily(
  ...args: Parameters<typeof collectFamilyTracking>
): Promise<TrackedFamilyDetail[]> {
  return collectFamilyTracking(...args)
}

async function collectFamilyTracking(
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
): Promise<TrackedFamilyDetail[]> {
  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const today = schoolToday(timeZone, reference)
  const { end } = schoolDayBounds(today, timeZone)
  const monthEnd = nextMonthStart(today)
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
  const families = new Map<string, TrackedFamilyDetail & { expectedByMonthEnd: number }>()
  for (const enrollment of enrollments) {
    const debtor = resolveDebtorFamily(enrollment.student.person.families)
    if (!debtor || (familyId && debtor.familyId !== familyId)) continue
    const period = enrollment.classAssignments[0]?.classPeriod.period
    const schedule = readPaymentSchedule(enrollment.plan.paymentSchedule)
    const paid = toNumber(paidByEnrollment.get(enrollment.id) ?? 0)
    const installments = period
      ? paymentInstallments(
          schedule,
          toNumber(enrollment.totalAmount),
          period.startAt,
          currency,
          startMonthFromDate(enrollment.startMonth)
        )
      : []
    const tracking = paymentTracking(installments, paid, today)
    const byMonthEnd = paymentTracking(installments, paid, monthEnd)
    const family = families.get(debtor.familyId) ?? {
      familyId: debtor.familyId,
      familyName: debtor.family.name,
      expectedToDate: 0,
      paidToDate: 0,
      overdueAmount: 0,
      dueThisMonth: 0,
      tracked: false,
      annualAmount: 0,
      creditedPaid: 0,
      fullyScheduled: true,
      expectedByMonthEnd: 0,
    }
    family.expectedToDate = roundHalfUp(family.expectedToDate + tracking.expectedToDate)
    family.expectedByMonthEnd = roundHalfUp(family.expectedByMonthEnd + byMonthEnd.expectedToDate)
    family.paidToDate = roundHalfUp(family.paidToDate + paid)
    family.creditedPaid = roundHalfUp(
      family.creditedPaid + Math.min(paid, toNumber(enrollment.totalAmount))
    )
    family.annualAmount = roundHalfUp(family.annualAmount + toNumber(enrollment.totalAmount))
    family.tracked ||= tracking.tracked
    family.fullyScheduled &&= tracking.tracked
    families.set(debtor.familyId, family)
  }
  // Family payments are allocated proportionally, so an advance on one enrollment
  // must also cover another enrollment's elapsed deadlines.
  for (const family of families.values()) {
    family.overdueAmount = Math.max(0, roundHalfUp(family.expectedToDate - family.creditedPaid))
    family.dueThisMonth = Math.max(0, roundHalfUp(family.expectedByMonthEnd - family.creditedPaid))
  }
  return [...families.values()]
    .map(({ expectedByMonthEnd: _expectedByMonthEnd, ...family }) => family)
    .sort((a, b) => b.overdueAmount - a.overdueAmount || a.familyName.localeCompare(b.familyName))
}

export async function getFamilyPaymentTracking(
  schoolId: string,
  familyId: string,
  reference?: Date
): Promise<FamilyPaymentTracking> {
  const { expectedToDate, overdueAmount, dueThisMonth, paidToDate, tracked } =
    await getFamilyPaymentTrackingDetail(schoolId, familyId, reference)
  return { expectedToDate, overdueAmount, dueThisMonth, paidToDate, tracked }
}

export async function getFamilyPaymentTrackingDetail(
  schoolId: string,
  familyId: string,
  reference?: Date
): Promise<FamilyPaymentTrackingDetail> {
  const [row] = await collectFamilyTracking(schoolId, { familyId, reference })
  if (!row) {
    return {
      expectedToDate: 0,
      overdueAmount: 0,
      dueThisMonth: 0,
      paidToDate: 0,
      tracked: false,
      annualAmount: 0,
      creditedPaid: 0,
      fullyScheduled: false,
    }
  }
  const { familyId: _familyId, familyName: _familyName, ...tracking } = row
  return tracking
}
