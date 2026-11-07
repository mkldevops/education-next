'use server'

import { revalidatePath } from 'next/cache'
import {
  archiveAbsenceReason,
  createAbsenceReason,
  reorderAbsenceReasons,
  updateAbsenceReason,
} from '@/use-cases/absence-reasons/manage-absence-reasons'
import { requireSchoolAdmin } from './auth-helper'

function revalidateReasons() {
  revalidatePath('/dashboard/config')
  revalidatePath('/dashboard/my-classes')
}

export async function createAbsenceReasonAction(input: { label: string; justified: boolean }) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createAbsenceReason({ ...input, schoolId })
  if (typeof result === 'string') return result
  revalidateReasons()
  return result
}

export async function updateAbsenceReasonAction(input: {
  id: string
  label?: string
  justified?: boolean
}) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updateAbsenceReason({ ...input, schoolId })
  if (result !== 'OK') return result
  revalidateReasons()
  return result
}

export async function archiveAbsenceReasonAction(input: { id: string }) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await archiveAbsenceReason({ ...input, schoolId })
  if (result !== 'OK') return result
  revalidateReasons()
  return result
}

export async function reorderAbsenceReasonsAction(input: { ids: string[] }) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await reorderAbsenceReasons({ ...input, schoolId })
  if (result !== 'OK') return result
  revalidateReasons()
  return result
}
