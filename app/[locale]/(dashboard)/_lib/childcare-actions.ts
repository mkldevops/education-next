'use server'

import { revalidatePath } from 'next/cache'
import { billChildcareMonth } from '@/use-cases/childcare/bill-childcare-month'
import { cancelChildcareCharge } from '@/use-cases/childcare/cancel-childcare-charge'
import { removeChildcareSubscription } from '@/use-cases/childcare/remove-childcare-subscription'
import { saveChildcareSubscription } from '@/use-cases/childcare/save-childcare-subscription'
import { requireSchoolAdmin } from './auth-helper'

function revalidateChildcare() {
  revalidatePath('/dashboard/childcare')
  revalidatePath('/dashboard/cashier')
}

export async function saveChildcareSubscriptionAction(data: {
  studentId: string
  monthlyAmount: number
  startMonth: string
  endMonth: string | null
}) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await saveChildcareSubscription({ ...data, schoolId })
  if (result === 'OK') revalidateChildcare()
  return result
}

export async function removeChildcareSubscriptionAction(studentId: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await removeChildcareSubscription({ studentId, schoolId })
  if (result === 'OK') revalidateChildcare()
  return result
}

export async function billChildcareMonthAction(month: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await billChildcareMonth({ month, schoolId, recordedById: userId })
  if (typeof result !== 'string') revalidateChildcare()
  return result
}

export async function cancelChildcareChargeAction(chargeId: string, reason: string) {
  const { schoolId, userId } = await requireSchoolAdmin()
  const result = await cancelChildcareCharge({
    chargeId,
    reason,
    schoolId,
    cancelledById: userId,
  })
  if (result === 'OK') revalidateChildcare()
  return result
}
