import { z } from 'zod'
import { earliestEndMonth, monthToDate } from '@/domain/childcare'
import { OPEN_ENROLLMENT_STATUSES } from '@/domain/enrollment'
import {
  owedThroughMonth,
  readPaymentSchedule,
  startMonthFromDate,
  startMonthSchema,
} from '@/domain/payment-schedule'
import { schoolToday } from '@/domain/school-date'
import {
  DEPARTURE_REMAINDERS,
  defaultDepartureMonth,
  departureMonths,
  departureSettlement,
} from '@/domain/student-departure'
import { childcareGateway } from '@/gateways/childcare-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { roundHalfUp, toNumber, toNumberOrNull } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { stopStudentMeals } from '@/use-cases/meals/stop-student-meals'

type Client = Prisma.TransactionClient | typeof db

export const previewStudentArchiveSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.uuid(),
  endMonth: startMonthSchema.optional(),
})

export const archiveStudentSchema = previewStudentArchiveSchema
  .extend({
    remainder: z.enum(DEPARTURE_REMAINDERS).default('keep'),
    reason: z.string().trim().max(500).optional(),
  })
  .transform((input) => ({ ...input, reason: input.reason || null }))

/** Open enrollments of the student, with what decides their amount owed through a month. */
function loadOpenEnrollments(client: Client, schoolId: string, studentId: string) {
  return client.enrollment.findMany({
    where: { schoolId, studentId, isActive: true, status: { in: [...OPEN_ENROLLMENT_STATUSES] } },
    select: {
      id: true,
      totalAmount: true,
      startMonth: true,
      firstInstallmentAmount: true,
      plan: { select: { paymentSchedule: true } },
      payments: { where: { isActive: true }, select: { amount: true } },
      classAssignments: {
        orderBy: { startAt: 'desc' },
        take: 1,
        select: {
          classPeriod: { select: { period: { select: { startAt: true, endAt: true } } } },
        },
      },
    },
  })
}

type OpenEnrollment = Awaited<ReturnType<typeof loadOpenEnrollments>>[number]

const periodOf = (enrollment: OpenEnrollment) =>
  enrollment.classAssignments[0]?.classPeriod.period ?? null

function owedThrough(enrollment: OpenEnrollment, endMonth: string, currency: string) {
  return owedThroughMonth(
    readPaymentSchedule(enrollment.plan.paymentSchedule),
    toNumber(enrollment.totalAmount),
    periodOf(enrollment)?.startAt ?? null,
    currency,
    {
      startMonth: startMonthFromDate(enrollment.startMonth),
      endMonth,
      firstInstallmentAmount: toNumberOrNull(enrollment.firstInstallmentAmount),
    }
  )
}

function monthsOf(enrollments: OpenEnrollment[], currentMonth: string) {
  const periods = enrollments.flatMap((enrollment) => {
    const period = periodOf(enrollment)
    return period ? [period] : []
  })
  return departureMonths(periods, currentMonth)
}

/**
 * What archiving a student after `endMonth` would leave owed: the selectable months, the
 * default one (the current school month) and, for the chosen month, the amount owed through
 * it by the open enrollments, already paid and still due.
 */
export async function previewStudentArchive(input: z.input<typeof previewStudentArchiveSchema>) {
  const parsed = previewStudentArchiveSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, studentId } = parsed.data

  const student = await db.student.findFirst({ where: { schoolId, id: studentId } })
  if (!student) return 'notFound' as const

  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const currentMonth = schoolToday(timeZone).slice(0, 7)
  const enrollments = await loadOpenEnrollments(db, schoolId, studentId)
  const months = monthsOf(enrollments, currentMonth)
  const defaultMonth = defaultDepartureMonth(months, currentMonth)
  const endMonth = parsed.data.endMonth ?? defaultMonth
  if (!months.includes(endMonth)) return 'endMonthOutsidePeriod' as const

  let owed = 0
  let paid = 0
  let prorated = true
  for (const enrollment of enrollments) {
    const through = owedThrough(enrollment, endMonth, currency)
    owed += through.amount
    paid += enrollment.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0)
    prorated &&= through.prorated
  }

  return {
    months,
    defaultMonth,
    endMonth,
    currency,
    openEnrollments: enrollments.length,
    owed: roundHalfUp(owed),
    paid: roundHalfUp(paid),
    remaining: Math.max(0, roundHalfUp(owed - paid)),
    prorated,
  }
}

/**
 * Already paid on an open enrollment, read under its debtor family's lock so that a payment
 * recorded concurrently waits for the new total (same lock as `readLockedPaidAmount`). An
 * archived family cannot be paid for any more: its enrollment is read without the lock.
 */
async function lockedPaid(tx: Prisma.TransactionClient, schoolId: string, enrollmentId: string) {
  const debtor = await enrollmentGateway.findDebtorFamily(tx, schoolId, enrollmentId)
  if (debtor?.familyId) await paymentGateway.lockFamilyForPayment(tx, schoolId, debtor.familyId)
  const locked = await enrollmentGateway.findOpenActivePayments(tx, schoolId, enrollmentId)
  if (!locked) return null
  return roundHalfUp(locked.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0))
}

/**
 * Archives a departed student in one transaction. Each open enrollment is closed
 * (`COMPLETED`, `endMonth`) with a total cut to its installments due through `endMonth`: the
 * remainder either stays owed (`keep`) or is written off with a mandatory reason. Its open
 * class assignments end now, so the student leaves its class and the attendance calls; its
 * childcare ends after `endMonth` (never before a month already billed). Meals stop from
 * today, once the transaction is committed.
 */
export async function archiveStudent(
  input: z.input<typeof archiveStudentSchema>,
  stopMeals = stopStudentMeals,
  now = new Date()
) {
  const parsed = archiveStudentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, studentId, remainder, reason } = parsed.data
  if (remainder === 'writeOff' && !reason) return 'reasonRequired' as const

  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const currentMonth = schoolToday(timeZone, now).slice(0, 7)

  const result = await db.$transaction(async (tx) => {
    // Every check runs before the first write: a result returned here still commits.
    const student = await tx.student.findFirst({ where: { schoolId, id: studentId } })
    if (!student) return 'notFound' as const
    const enrollments = await loadOpenEnrollments(tx, schoolId, studentId)
    const months = monthsOf(enrollments, currentMonth)
    const endMonth = parsed.data.endMonth ?? defaultDepartureMonth(months, currentMonth)
    if (!months.includes(endMonth)) return 'endMonthOutsidePeriod' as const

    const archived = await tx.student.updateMany({
      where: { schoolId, id: studentId, isActive: true },
      data: { isActive: false, leftAt: now },
    })
    if (archived.count === 0) return 'notFound' as const

    for (const enrollment of enrollments) {
      const paid = await lockedPaid(tx, schoolId, enrollment.id)
      if (paid === null) continue
      const owed = owedThrough(enrollment, endMonth, currency).amount
      const settlement = departureSettlement(owed, paid, remainder)
      await tx.enrollment.update({
        where: { id_schoolId: { id: enrollment.id, schoolId } },
        data: {
          status: 'COMPLETED',
          endMonth: monthToDate(endMonth),
          totalAmount: settlement.totalAmount,
          writeOffAmount: settlement.writeOffAmount,
          writeOffReason: remainder === 'writeOff' ? reason : null,
        },
      })
    }

    await tx.classAssignment.updateMany({
      where: { schoolId, endAt: null, enrollment: { studentId } },
      data: { endAt: now },
    })

    const subscription = await childcareGateway.lockSubscriptionStart(tx, schoolId, studentId)
    if (subscription) {
      const billed = await childcareGateway.listLiveMonths(tx, schoolId, subscription.id)
      const lastBilled = earliestEndMonth(
        billed.map((month) => ({ month, cancelled: false })),
        subscription.startMonth
      )
      const childcareEnd = [endMonth, lastBilled].sort()[1]
      await tx.childcareSubscription.updateMany({
        where: {
          schoolId,
          id: subscription.id,
          OR: [{ endMonth: null }, { endMonth: { gt: monthToDate(childcareEnd) } }],
        },
        data: { endMonth: monthToDate(childcareEnd) },
      })
    }

    return 'OK' as const
  })
  if (result !== 'OK') return result

  await stopMeals({ schoolId, studentId }, undefined, now)
  return 'OK' as const
}
