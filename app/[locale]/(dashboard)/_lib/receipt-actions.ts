'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { cancelReceipt } from '@/use-cases/receipts/cancel-receipt'
import { recordReceipt } from '@/use-cases/receipts/record-receipt'
import type { recordReceiptSchema } from '@/use-cases/receipts/schemas'
import { requireSchoolAdmin, requireSchoolCashier } from './auth-helper'

type RecordReceiptInput = z.input<typeof recordReceiptSchema>

export async function recordReceiptAction(
  data: Omit<RecordReceiptInput, 'schoolId' | 'recordedById'>
) {
  const { schoolId, userId } = await requireSchoolCashier()
  const result = await recordReceipt({ ...data, schoolId, recordedById: userId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/cashier')
  revalidatePath(`/dashboard/families/${data.familyId}`)
  return result
}

export async function cancelReceiptAction(receiptId: string, reason: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await cancelReceipt({ receiptId, reason, schoolId, cancelledById: userId })
  if (result !== 'OK') return result
  revalidatePath(`/dashboard/cashier/receipts/${receiptId}`)
  revalidatePath('/dashboard/cashier')
  return 'OK' as const
}
