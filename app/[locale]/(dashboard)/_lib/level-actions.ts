'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createLevel } from '@/use-cases/levels/create-level'
import type { createLevelSchema, setNextLevelSchema } from '@/use-cases/levels/schemas'
import { setNextLevel } from '@/use-cases/levels/set-next-level'
import { requireAdmin } from './auth-helper'

type CreateLevelInput = z.infer<typeof createLevelSchema>
type SetNextLevelInput = z.infer<typeof setNextLevelSchema>

export async function createLevelAction(data: CreateLevelInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await createLevel(data)
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/levels')
  return result
}

export async function setNextLevelAction(data: SetNextLevelInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await setNextLevel(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/levels')
  return 'OK' as const
}
