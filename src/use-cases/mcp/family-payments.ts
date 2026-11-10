import type { z } from 'zod'
import { enrollmentBalances, totalPaidAmount } from '@/domain/payment'
import {
  installmentCoverage,
  paymentInstallments,
  readPaymentSchedule,
  startMonthFromDate,
} from '@/domain/payment-schedule'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { roundHalfUp, toNumber } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { getFamilyPaymentTracking } from '@/use-cases/payments/payment-tracking'
import type { DraftScope } from './draft-scope'
import { mcpFamilyPaymentsSchema } from './schemas'

type Input = z.infer<typeof mcpFamilyPaymentsSchema>

const RECENT_PAYMENTS = 20

/**
 * Reste à payer par inscription ouverte et derniers encaissements de la famille, avec leur
 * identifiant : ce qu'il faut pour proposer un montant ou annuler une saisie erronée.
 * Chaque inscription rend ses échéances et celles que les paiements reçus couvrent.
 */
export async function familyPaymentsFromMcp(scope: DraftScope, input: Input) {
  const parsed = mcpFamilyPaymentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const { schoolId } = scope

  const family = await familyGateway.findById(schoolId, parsed.data.familyId)
  if (!family) return 'notFound' as const

  const enrollments = await enrollmentGateway.findPayableByFamily(schoolId, family.id)
  const [payments, tracking, schedules, { currency }] = await Promise.all([
    mcpReadGateway.listFamilyPayments(schoolId, family.id, RECENT_PAYMENTS),
    getFamilyPaymentTracking(schoolId, family.id),
    mcpReadGateway.listEnrollmentSchedules(
      schoolId,
      enrollments.map((enrollment) => enrollment.id)
    ),
    getSchoolRegionalSettings(schoolId),
  ])
  const scheduleById = new Map(schedules.map((row) => [row.id, row]))
  const balances = enrollmentBalances(enrollments)

  return {
    family: { id: family.id, name: family.name },
    remainingBalance: roundHalfUp(balances.reduce((sum, row) => sum + row.remainingBalance, 0)),
    paidAmount: roundHalfUp(
      enrollments.reduce(
        (sum, enrollment) =>
          sum + enrollment.payments.reduce((paid, payment) => paid + toNumber(payment.amount), 0),
        0
      )
    ),
    tracking,
    enrollments: balances.map((balance, index) => {
      const enrollment = enrollments[index]
      const schedule = scheduleById.get(balance.enrollmentId)
      const period = schedule?.classAssignments[0]?.classPeriod.period
      const installments =
        schedule && period
          ? paymentInstallments(
              readPaymentSchedule(schedule.plan.paymentSchedule),
              toNumber(schedule.totalAmount),
              period.startAt,
              currency,
              startMonthFromDate(schedule.startMonth)
            )
          : []
      return {
        ...balance,
        student: enrollment?.studentName ?? null,
        paidAmount: totalPaidAmount(enrollment?.payments ?? []),
        installments: installmentCoverage(
          installments,
          totalPaidAmount(enrollment?.payments ?? [])
        ),
      }
    }),
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toString(),
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt,
      cashedAt: payment.cashedAt,
      online: payment.paymentTransactionId !== null,
      enrollmentId: payment.enrollment.id,
      student: payment.enrollment.student.person,
    })),
  }
}
