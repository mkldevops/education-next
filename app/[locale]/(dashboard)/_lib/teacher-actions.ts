'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createTeacher } from '@/use-cases/teachers/create-teacher'
import { createTeacherExpense } from '@/use-cases/teachers/create-teacher-expense'
import type {
  createTeacherExpenseSchema,
  createTeacherSchema,
  updateTeacherSchema,
} from '@/use-cases/teachers/schemas'
import { updateTeacher } from '@/use-cases/teachers/update-teacher'
import { requireSchoolAdmin } from './auth-helper'

type CreateTeacherInput = z.infer<typeof createTeacherSchema>
type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>
type CreateTeacherExpenseInput = z.infer<typeof createTeacherExpenseSchema>

export async function createTeacherAction(data: Omit<CreateTeacherInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createTeacher({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/teachers')
  return result
}

export async function updateTeacherAction(
  id: string,
  data: Omit<UpdateTeacherInput, 'id' | 'schoolId'>
) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updateTeacher({ ...data, id, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/teachers')
  revalidatePath('/dashboard/classes')
  return result
}

export async function createTeacherExpenseAction(
  data: Omit<CreateTeacherExpenseInput, 'schoolId'>
) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createTeacherExpense({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/teachers')
  return result
}
