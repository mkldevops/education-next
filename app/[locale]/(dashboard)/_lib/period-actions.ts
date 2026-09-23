'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createPeriod } from '@/use-cases/periods/create-period'
import { deactivatePeriod } from '@/use-cases/periods/deactivate-period'
import type {
  createPeriodSchema,
  deactivatePeriodSchema,
  updatePeriodSchema,
} from '@/use-cases/periods/schemas'
import { updatePeriod } from '@/use-cases/periods/update-period'
import { requireSchoolAdmin } from './auth-helper'

type CreatePeriodInput = Omit<z.infer<typeof createPeriodSchema>, 'schoolId'>
type UpdatePeriodInput = Omit<z.infer<typeof updatePeriodSchema>, 'schoolId'>
type DeactivatePeriodInput = Omit<z.infer<typeof deactivatePeriodSchema>, 'schoolId'>

export async function createPeriodAction(data: CreatePeriodInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createPeriod({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/periods')
  return result
}

export async function updatePeriodAction(id: string, data: Omit<UpdatePeriodInput, 'id'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updatePeriod({ ...data, id, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/periods')
  return result
}

export async function deactivatePeriodAction(data: DeactivatePeriodInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await deactivatePeriod({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/periods')
  return 'OK' as const
}
