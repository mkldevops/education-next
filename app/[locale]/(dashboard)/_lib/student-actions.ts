'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createStudent } from '@/use-cases/students/create-student'
import { deactivateStudent } from '@/use-cases/students/deactivate-student'
import type { createStudentSchema, updateStudentSchema } from '@/use-cases/students/schemas'
import { updateStudent } from '@/use-cases/students/update-student'
import { requireAdmin } from './auth-helper'

type CreateStudentInput = z.infer<typeof createStudentSchema>
type UpdateStudentInput = z.infer<typeof updateStudentSchema>

export async function createStudentAction(data: CreateStudentInput) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await createStudent(data)
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/students')
  return result
}

export async function updateStudentAction(id: string, data: Omit<UpdateStudentInput, 'id'>) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await updateStudent({ id, ...data })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/students')
  return result
}

export async function deactivateStudentAction(id: string) {
  const user = await requireAdmin()
  if (!user) return 'unauthorized' as const
  const result = await deactivateStudent({ id })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/students')
  return 'OK' as const
}
