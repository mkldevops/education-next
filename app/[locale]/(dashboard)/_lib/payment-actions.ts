'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { cancelPayments } from '@/use-cases/payments/cancel-payments'
import { recordPayment } from '@/use-cases/payments/record-payment'
import type { recordPaymentSchema } from '@/use-cases/payments/schemas'
import { issueReceiptForPayments } from '@/use-cases/receipts/issue-receipt-for-payments'
import { requireSchoolAdmin } from './auth-helper'

type RecordPaymentInput = Omit<z.infer<typeof recordPaymentSchema>, 'schoolId' | 'recordedById'>

export async function recordPaymentAction(data: RecordPaymentInput) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await recordPayment({ ...data, schoolId, recordedById: userId })
  if (typeof result === 'string' && result !== 'OK') return result
  revalidatePath('/dashboard/payments')
  revalidatePath(`/dashboard/families/${data.familyId}`)
  return result
}

export async function issueReceiptForPaymentsAction(paymentIds: string[]) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await issueReceiptForPayments({ paymentIds, schoolId, recordedById: userId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/families/[id]', 'page')
  return result
}

export async function cancelPaymentsAction(paymentIds: string[], reason?: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await cancelPayments({ paymentIds, reason, schoolId, cancelledById: userId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/payments')
  revalidatePath(`/dashboard/families/${result.familyId}`)
  return 'OK' as const
}
