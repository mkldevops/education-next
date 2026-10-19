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
  setNextLevelsSchema,
} from '@/use-cases/levels/schemas'
import { setNextLevels } from '@/use-cases/levels/set-next-levels'
import { requireSchoolAdmin } from './auth-helper'

type CreateLevelInput = Omit<z.infer<typeof createLevelSchema>, 'schoolId'>
type SetNextLevelsInput = Omit<z.infer<typeof setNextLevelsSchema>, 'schoolId'>
type RenameLevelInput = Omit<z.infer<typeof renameLevelSchema>, 'schoolId'>
type DeactivateLevelInput = Omit<z.infer<typeof deactivateLevelSchema>, 'schoolId'>

export async function createLevelAction(data: CreateLevelInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createLevel({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/levels')
  return result
}

export async function setNextLevelsAction(data: SetNextLevelsInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await setNextLevels({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/levels')
  return 'OK' as const
}

export async function renameLevelAction(data: RenameLevelInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await renameLevel({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/levels')
  revalidatePath('/dashboard/classes')
  return 'OK' as const
}

export async function deactivateLevelAction(data: DeactivateLevelInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await deactivateLevel({ ...data, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/levels')
  return 'OK' as const
}
