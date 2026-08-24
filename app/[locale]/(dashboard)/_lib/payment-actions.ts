'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { recordPayment } from '@/use-cases/payments/record-payment'
import type { recordPaymentSchema } from '@/use-cases/payments/schemas'
import { requireSchoolAdmin } from './auth-helper'

type RecordPaymentInput = Omit<z.infer<typeof recordPaymentSchema>, 'schoolId'>

export async function recordPaymentAction(data: RecordPaymentInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await recordPayment({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/payments')
  revalidatePath(`/dashboard/families/${data.familyId}`)
  return result
}
