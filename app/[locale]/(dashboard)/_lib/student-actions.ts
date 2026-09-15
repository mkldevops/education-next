'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { createEnrolledStudent } from '@/use-cases/students/create-enrolled-student'
import { createStudent } from '@/use-cases/students/create-student'
import { deactivateStudent } from '@/use-cases/students/deactivate-student'
import type {
  createEnrolledStudentSchema,
  createStudentSchema,
  updateStudentSchema,
} from '@/use-cases/students/schemas'
import { updateStudent } from '@/use-cases/students/update-student'
import { requireSchoolAdmin } from './auth-helper'

type CreateStudentInput = z.infer<typeof createStudentSchema>
type UpdateStudentInput = z.infer<typeof updateStudentSchema>
type NewStudentEnrollment = z.input<typeof createEnrolledStudentSchema>['enrollment']

/**
 * Une seule action pour les deux gestes du dialogue « Ajouter un élève » : sans `enrollment`
 * l'élève est simplement rattaché à la famille, avec `enrollment` il est créé et inscrit dans
 * la même transaction.
 *
 * Les deux branches répondent la même forme — `enrollmentId` nul quand rien n'a été inscrit —
 * pour qu'un appelant n'ait pas à deviner laquelle a servi.
 */
export async function createStudentAction(
  data: Omit<CreateStudentInput, 'schoolId'> & { enrollment?: NewStudentEnrollment }
) {
  const { schoolId } = await requireSchoolAdmin()
  const { enrollment, ...student } = data

  if (enrollment) {
    const result = await createEnrolledStudent({ ...student, enrollment, schoolId })
    if (typeof result === 'string') return result
    revalidatePath('/dashboard/students')
    revalidatePath(`/dashboard/families/${data.familyId}`)
    revalidatePath('/dashboard/enrollments')
    revalidatePath('/dashboard')
    return result
  }

  const created = await createStudent({ ...student, schoolId })
  if (typeof created === 'string') return created
  revalidatePath('/dashboard/students')
  revalidatePath(`/dashboard/families/${data.familyId}`)
  return { studentId: created.id, enrollmentId: null }
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
