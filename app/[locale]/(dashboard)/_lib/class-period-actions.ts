'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createClassPeriod } from '@/use-cases/class-periods/create-class-period'
import type {
  createClassPeriodSchema,
  updateClassPeriodSchema,
} from '@/use-cases/class-periods/schemas'
import { updateClassPeriod } from '@/use-cases/class-periods/update-class-period'
import { requireSchoolAdmin } from './auth-helper'

type CreateClassPeriodInput = z.input<typeof createClassPeriodSchema>
type UpdateClassPeriodInput = z.input<typeof updateClassPeriodSchema>

// `schoolId` et `id` sont posés APRÈS le spread : une Server Action est un endpoint
// HTTP, donc `data` est un payload arbitraire et l'`Omit` du type ne contraint que
// la compilation. Dans l'autre ordre, le client écrasait l'école du garde.
export async function createClassPeriodAction(data: Omit<CreateClassPeriodInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createClassPeriod({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/classes')
  return result
}

export async function updateClassPeriodAction(
  id: string,
  data: Omit<UpdateClassPeriodInput, 'id' | 'schoolId'>
) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updateClassPeriod({ ...data, id, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/classes')
  revalidatePath(`/dashboard/classes/${id}`)
  return result
}
