'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createPlan } from '@/use-cases/plans/create-plan'
import type { createPlanSchema, updatePlanSchema } from '@/use-cases/plans/schemas'
import { updatePlan } from '@/use-cases/plans/update-plan'
import { requireSchoolAdmin } from './auth-helper'

type CreatePlanInput = z.infer<typeof createPlanSchema>
type UpdatePlanInput = z.infer<typeof updatePlanSchema>

export async function createPlanAction(data: Omit<CreatePlanInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createPlan({ schoolId, ...data })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/plans')
  return result
}

export async function updatePlanAction(id: string, data: Omit<UpdatePlanInput, 'id' | 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updatePlan({ schoolId, id, ...data })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/plans')
  return result
}
