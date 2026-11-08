'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { recordStaffReceipt } from '@/use-cases/staff/record-staff-receipt'
import type { recordStaffReceiptSchema, setStaffMealExemptSchema } from '@/use-cases/staff/schemas'
import { setStaffMealExempt } from '@/use-cases/staff/set-staff-meal-exempt'
import { requireSchoolAdmin, requireSchoolCashier } from './auth-helper'

type ExemptInput = z.input<typeof setStaffMealExemptSchema>
type ReceiptInput = z.input<typeof recordStaffReceiptSchema>

export async function setStaffMealExemptAction(data: Omit<ExemptInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await setStaffMealExempt({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/cashier/staff')
  revalidatePath(`/dashboard/cashier/staff/${data.id}`)
  return 'OK' as const
}

export async function recordStaffReceiptAction(
  data: Omit<ReceiptInput, 'schoolId' | 'recordedById'>
) {
  const { schoolId, userId } = await requireSchoolCashier()
  const result = await recordStaffReceipt({ ...data, schoolId, recordedById: userId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/cashier')
  revalidatePath(`/dashboard/cashier/staff/${data.teacherId}`)
  return result
}
