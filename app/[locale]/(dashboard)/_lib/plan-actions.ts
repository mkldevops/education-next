'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createPlan } from '@/use-cases/plans/create-plan'
import type { createPlanSchema } from '@/use-cases/plans/schemas'
import { requireAdmin } from './auth-helper'

type CreatePlanInput = z.infer<typeof createPlanSchema>

export async function createPlanAction(data: CreatePlanInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await createPlan(data)
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/plans')
  return result
}
