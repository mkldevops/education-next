'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { archiveTeacher } from '@/use-cases/teachers/archive-teacher'
import { createTeacher } from '@/use-cases/teachers/create-teacher'
import { createTeacherExpense } from '@/use-cases/teachers/create-teacher-expense'
import { deleteTeacher } from '@/use-cases/teachers/delete-teacher'
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

export async function revokeTeacherAccessAction(id: string) {
  const { schoolId } = await requireSchoolAdmin()
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return 'validationError' as const

  const result = await teacherGateway.revokeUserAccess(schoolId, parsed.data)
  if (result !== 'OK') return result
  revalidatePath('/dashboard/teachers')
  revalidatePath('/dashboard/my-classes')
  revalidatePath('/dashboard/users')
  return 'OK' as const
}

export async function archiveTeacherAction(id: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await archiveTeacher({ schoolId, id })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/teachers')
  revalidatePath('/dashboard/classes')
  revalidatePath('/dashboard/my-classes')
  revalidatePath('/dashboard/users')
  return result
}

export async function deleteTeacherAction(id: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await deleteTeacher({ schoolId, id })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/teachers')
  return result
}
