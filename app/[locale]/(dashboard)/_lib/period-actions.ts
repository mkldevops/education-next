'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createPeriod } from '@/use-cases/periods/create-period'
import type { createPeriodSchema, updatePeriodSchema } from '@/use-cases/periods/schemas'
import { updatePeriod } from '@/use-cases/periods/update-period'
import { requireAdmin } from './auth-helper'

type CreatePeriodInput = z.infer<typeof createPeriodSchema>
type UpdatePeriodInput = z.infer<typeof updatePeriodSchema>

export async function createPeriodAction(data: CreatePeriodInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await createPeriod(data)
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/periods')
  return result
}

export async function updatePeriodAction(id: string, data: Omit<UpdatePeriodInput, 'id'>) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await updatePeriod({ id, ...data })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/periods')
  return result
}
