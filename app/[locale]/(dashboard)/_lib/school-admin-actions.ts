'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createSchool } from '@/use-cases/schools/create-school'
import type { DeactivateSchoolResult } from '@/use-cases/schools/deactivate-school'
import { deactivateSchool } from '@/use-cases/schools/deactivate-school'
import { reactivateSchool } from '@/use-cases/schools/reactivate-school'
import type { createSchoolSchema, updateSchoolSchema } from '@/use-cases/schools/schemas'
import { updateSchool } from '@/use-cases/schools/update-school'
import { requirePlatformAdmin } from './auth-helper'

const SCHOOLS_PATH = '/dashboard/schools'

type CreateSchoolInput = z.infer<typeof createSchoolSchema>
type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>

export async function createSchoolAction(data: CreateSchoolInput) {
  await requirePlatformAdmin()

  const result = await createSchool(data)
  if (typeof result === 'string') return result

  revalidatePath(SCHOOLS_PATH)
  return 'OK' as const
}

export async function updateSchoolAction(data: UpdateSchoolInput) {
  await requirePlatformAdmin()

  const result = await updateSchool(data)
  if (result !== 'OK') return result

  revalidatePath(SCHOOLS_PATH)
  return 'OK' as const
}

/**
 * Renvoie le verdict complet, blocages compris : l'écran doit pouvoir énumérer ce qui
 * retient l'école plutôt qu'afficher un refus opaque.
 */
export async function deactivateSchoolAction(id: string): Promise<DeactivateSchoolResult> {
  await requirePlatformAdmin()

  const result = await deactivateSchool({ id })
  if (result.status !== 'OK') return result

  revalidatePath(SCHOOLS_PATH)
  revalidatePath('/dashboard')
  return result
}

export async function reactivateSchoolAction(id: string) {
  await requirePlatformAdmin()

  const result = await reactivateSchool({ id })
  if (result !== 'OK') return result

  revalidatePath(SCHOOLS_PATH)
  revalidatePath('/dashboard')
  return 'OK' as const
}
