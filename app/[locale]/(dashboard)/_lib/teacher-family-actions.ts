'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import { db } from '@/lib/db'
import { createFamily } from '@/use-cases/families/create-family'
import type { createFamilySchema } from '@/use-cases/families/schemas'
import { createStudent } from '@/use-cases/students/create-student'
import { createStudentSchema } from '@/use-cases/students/schemas'
import { requireTeacher } from './auth-helper'

type CreateFamilyInput = z.input<typeof createFamilySchema>
type CreateStudentInput = z.input<typeof createStudentSchema>

const revalidateFamilies = () => {
  revalidatePath('/dashboard/my-families')
  revalidatePath('/dashboard/families')
  revalidatePath('/dashboard/students')
}

/**
 * Un enseignant enregistre une famille pour l'école ; l'administration l'inscrit ensuite.
 * Il n'obtient aucune lecture des autres familles : seules celles qu'il a créées lui sont
 * rendues sur `/dashboard/my-families`.
 */
export async function createFamilyAsTeacherAction(
  data: Omit<CreateFamilyInput, 'schoolId' | 'createdById'>
) {
  const { schoolId, userId } = await requireTeacher()
  const result = await createFamily({ ...data, schoolId, createdById: userId })
  if (typeof result === 'string') return result
  revalidateFamilies()
  return { id: result.id }
}

/** L'ajout d'élève est borné aux familles créées par ce compte, sans inscription. */
export async function createStudentAsTeacherAction(data: Omit<CreateStudentInput, 'schoolId'>) {
  const { schoolId, userId } = await requireTeacher()
  const parsed = createStudentSchema.omit({ schoolId: true }).safeParse(data)
  if (!parsed.success) return 'validationError' as const

  const family = await db.family.findFirst({
    where: { id: parsed.data.familyId, schoolId, createdById: userId, isActive: true },
    select: { id: true },
  })
  if (!family) return 'notFound' as const

  const created = await createStudent({ ...parsed.data, schoolId })
  if (typeof created === 'string') return created
  revalidateFamilies()
  return { studentId: created.id }
}
