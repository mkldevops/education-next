import type { z } from 'zod'
import { createTeacher } from '@/use-cases/teachers/create-teacher'
import { mcpCreateTeacherSchema } from './schemas'

type Input = z.infer<typeof mcpCreateTeacherSchema>

/**
 * Crée un enseignant sans classe : l'affecter à une classe est une autre opération, faite
 * ensuite dans la période voulue. Le formulaire du tableau de bord ne demande rien de plus.
 */
export async function createTeacherFromMcp(
  scope: { schoolId: string },
  input: Input,
  create = createTeacher
) {
  const parsed = mcpCreateTeacherSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const teacher = await create({ ...parsed.data, schoolId: scope.schoolId })
  if (typeof teacher === 'string') return teacher
  return { id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName }
}
