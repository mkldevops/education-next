'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { recordPayment } from '@/use-cases/payments/record-payment'
import type { recordPaymentSchema } from '@/use-cases/payments/schemas'
import { requireAdmin } from './auth-helper'

type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export async function recordPaymentAction(data: RecordPaymentInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await recordPayment(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/payments')
  return result
}
