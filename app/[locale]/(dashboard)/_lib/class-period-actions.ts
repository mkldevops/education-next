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

type CreateClassPeriodInput = z.infer<typeof createClassPeriodSchema>
type UpdateClassPeriodInput = z.infer<typeof updateClassPeriodSchema>

export async function createClassPeriodAction(data: Omit<CreateClassPeriodInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createClassPeriod({ schoolId, ...data })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/classes')
  return result
}

export async function updateClassPeriodAction(
  id: string,
  data: Omit<UpdateClassPeriodInput, 'id' | 'schoolId'>
) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updateClassPeriod({ schoolId, id, ...data })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/classes')
  return result
}
