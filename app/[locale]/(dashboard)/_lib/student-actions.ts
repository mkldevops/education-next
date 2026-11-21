'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { syncOpenAttendanceRosters } from '@/use-cases/attendance/attendance-roster'
import {
  archiveStudent,
  type archiveStudentSchema,
  previewStudentArchive,
} from '@/use-cases/students/archive-student'
import { createEnrolledStudent } from '@/use-cases/students/create-enrolled-student'
import { createStudent } from '@/use-cases/students/create-student'
import { reinstateStudent } from '@/use-cases/students/reinstate-student'
import type {
  createEnrolledStudentSchema,
  createStudentSchema,
  updateStudentSchema,
} from '@/use-cases/students/schemas'
import { updateStudent } from '@/use-cases/students/update-student'
import { requireSchoolAdmin, requireSchoolStaff } from './auth-helper'

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
  const { schoolId, userId, isAdmin } = await requireSchoolStaff()
  const { enrollment, ...student } = data

  if (enrollment) {
    const result = await createEnrolledStudent({
      ...student,
      enrollment,
      schoolId,
      deferPricing: !isAdmin,
    })
    if (typeof result === 'string') return result
    await syncOpenAttendanceRosters({
      schoolId,
      actorId: userId,
      enrollmentIds: [result.enrollmentId],
    })
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
  const { schoolId } = await requireSchoolStaff()
  const result = await updateStudent({ ...data, id, schoolId })
  if (typeof result === 'string') return result
  revalidatePath('/dashboard/students')
  return result
}

type ArchiveStudentInput = Omit<z.input<typeof archiveStudentSchema>, 'schoolId'>

/** Ce qu'archiver l'élève après `endMonth` laisserait dû ; réservé aux administrateurs. */
export async function previewStudentArchiveAction(studentId: string, endMonth?: string) {
  const { schoolId } = await requireSchoolAdmin()
  return previewStudentArchive({ schoolId, studentId, endMonth })
}

/** Archive un élève parti : clôt ses inscriptions au dernier mois, garde ou annule le reste dû. */
export async function archiveStudentAction(input: ArchiveStudentInput) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await archiveStudent({ ...input, schoolId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/students')
  revalidatePath('/dashboard/enrollments')
  revalidatePath('/dashboard/families')
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard')
  return 'OK' as const
}

/** Réintègre un élève archivé ; ses inscriptions closes restent closes, on le réinscrit ensuite. */
export async function reinstateStudentAction(studentId: string) {
  const { schoolId } = await requireSchoolAdmin()
  const result = await reinstateStudent({ schoolId, studentId })
  if (result !== 'OK') return result
  revalidatePath('/dashboard/students')
  revalidatePath(`/dashboard/students/${studentId}`)
  revalidatePath('/dashboard/families')
  revalidatePath('/dashboard')
  return 'OK' as const
}
