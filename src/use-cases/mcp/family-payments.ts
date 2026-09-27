import type { z } from 'zod'
import { enrollmentBalances } from '@/domain/payment'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { roundHalfUp } from '@/lib/decimal'
import type { DraftScope } from './draft-scope'
import { mcpFamilyPaymentsSchema } from './schemas'

type Input = z.infer<typeof mcpFamilyPaymentsSchema>

const RECENT_PAYMENTS = 20

/**
 * Reste à payer par inscription ouverte et derniers encaissements de la famille, avec leur
 * identifiant : ce qu'il faut pour proposer un montant ou annuler une saisie erronée.
 */
export async function familyPaymentsFromMcp(scope: DraftScope, input: Input) {
  const parsed = mcpFamilyPaymentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const { schoolId } = scope

  const family = await familyGateway.findById(schoolId, parsed.data.familyId)
  if (!family) return 'notFound' as const

  const [enrollments, payments] = await Promise.all([
    enrollmentGateway.findPayableByFamily(schoolId, family.id),
    mcpReadGateway.listFamilyPayments(schoolId, family.id, RECENT_PAYMENTS),
  ])
  const balances = enrollmentBalances(enrollments)

  return {
    family: { id: family.id, name: family.name },
    remainingBalance: roundHalfUp(balances.reduce((sum, row) => sum + row.remainingBalance, 0)),
    enrollments: balances,
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
