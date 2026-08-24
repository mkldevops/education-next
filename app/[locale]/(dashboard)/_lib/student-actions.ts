'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createStudent } from '@/use-cases/students/create-student'
import { deactivateStudent } from '@/use-cases/students/deactivate-student'
import type { createStudentSchema, updateStudentSchema } from '@/use-cases/students/schemas'
import { updateStudent } from '@/use-cases/students/update-student'
import { requireSchoolAdmin } from './auth-helper'

type CreateStudentInput = z.infer<typeof createStudentSchema>
type UpdateStudentInput = z.infer<typeof updateStudentSchema>

export async function createStudentAction(data: Omit<CreateStudentInput, 'schoolId'>) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await createStudent({ ...data, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/students')
  revalidatePath(`/dashboard/families/${data.familyId}`)
  return result
}

export async function updateStudentAction(
  id: string,
  data: Omit<UpdateStudentInput, 'schoolId' | 'id'>
) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await updateStudent({ schoolId, id, ...data })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/students')
  return result
}

export async function deactivateStudentAction(id: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await deactivateStudent({ schoolId, id })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/students')
  return 'OK' as const
}
