'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { recordStaffReceipt } from '@/use-cases/staff/record-staff-receipt'
import { createStaffMember, updateStaffMember } from '@/use-cases/staff/save-staff-member'
import type {
  createStaffMemberSchema,
  recordStaffReceiptSchema,
  updateStaffMemberSchema,
} from '@/use-cases/staff/schemas'
import { requireSchoolAdmin, requireSchoolCashier } from './auth-helper'

type CreateInput = z.input<typeof createStaffMemberSchema>
type UpdateInput = z.input<typeof updateStaffMemberSchema>
type ReceiptInput = z.input<typeof recordStaffReceiptSchema>

export async function createStaffMemberAction(data: Omit<CreateInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createStaffMember({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/cashier/staff')
  return 'OK' as const
}

export async function updateStaffMemberAction(data: Omit<UpdateInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updateStaffMember({ ...data, schoolId })
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
  revalidatePath(`/dashboard/cashier/staff/${data.staffMemberId}`)
  return result
}
