'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createLevel } from '@/use-cases/levels/create-level'
import { deactivateLevel } from '@/use-cases/levels/deactivate-level'
import { renameLevel } from '@/use-cases/levels/rename-level'
import type {
  createLevelSchema,
  deactivateLevelSchema,
  renameLevelSchema,
  setNextLevelSchema,
} from '@/use-cases/levels/schemas'
import { setNextLevel } from '@/use-cases/levels/set-next-level'
import { requireAdmin } from './auth-helper'

type CreateLevelInput = z.infer<typeof createLevelSchema>
type SetNextLevelInput = z.infer<typeof setNextLevelSchema>
type RenameLevelInput = z.infer<typeof renameLevelSchema>
type DeactivateLevelInput = z.infer<typeof deactivateLevelSchema>

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

export async function renameLevelAction(data: RenameLevelInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await renameLevel(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/levels')
  revalidatePath('/dashboard/classes')
  return 'OK' as const
}

export async function deactivateLevelAction(data: DeactivateLevelInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await deactivateLevel(data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/levels')
  return 'OK' as const
}
