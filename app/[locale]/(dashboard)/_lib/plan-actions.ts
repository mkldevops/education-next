'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createPlan } from '@/use-cases/plans/create-plan'
import { deactivatePlan } from '@/use-cases/plans/deactivate-plan'
import type { createPlanSchema, updatePlanSchema } from '@/use-cases/plans/schemas'
import { updatePlan } from '@/use-cases/plans/update-plan'
import { requireSchoolAdmin } from './auth-helper'

type CreatePlanInput = z.infer<typeof createPlanSchema>
type UpdatePlanInput = z.infer<typeof updatePlanSchema>

export async function createPlanAction(data: Omit<CreatePlanInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createPlan({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/plans')
  return result
}

export async function updatePlanAction(id: string, data: Omit<UpdatePlanInput, 'id' | 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updatePlan({ ...data, id, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/plans')
  return result
}

export async function deactivatePlanAction(id: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await deactivatePlan({ id, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/plans')
  return 'OK' as const
}
