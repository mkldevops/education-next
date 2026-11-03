import type { z } from 'zod'
import { cancelPayments } from '@/use-cases/payments/cancel-payments'
import type { DraftScope } from './draft-scope'
import { mcpCancelPaymentsSchema } from './schemas'

type Input = z.infer<typeof mcpCancelPaymentsSchema>

/** `cancel_payments` : mêmes règles et mêmes refus que l'annulation du tableau de bord. */
export async function cancelPaymentsFromMcp(scope: DraftScope, input: Input) {
  const parsed = mcpCancelPaymentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  return cancelPayments({
    ...parsed.data,
    schoolId: scope.schoolId,
    cancelledById: scope.userId,
  })
}
