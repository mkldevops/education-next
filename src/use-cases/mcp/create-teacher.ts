import type { z } from 'zod'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { createTeacher } from '@/use-cases/teachers/create-teacher'
import { mcpCreateTeacherSchema } from './schemas'

type Input = z.infer<typeof mcpCreateTeacherSchema>

/**
 * Crée un enseignant sans classe : l'affecter à une classe est une autre opération, faite
 * ensuite dans la période voulue. Le formulaire du tableau de bord ne demande rien de plus.
 *
 * Une fiche relue deux fois, ou un enseignant déjà saisi au tableau de bord, ne doit pas
 * ressortir en double : un homonyme actif, ou la même adresse, suspend la création et rend
 * les fiches trouvées. `allowDuplicate` crée quand même, sur décision de l'humain.
 */
export async function createTeacherFromMcp(
  scope: { schoolId: string },
  input: Input,
  create = createTeacher,
  teacherGw: Pick<typeof teacherGateway, 'findPossibleDuplicates'> = teacherGateway
) {
  const parsed = mcpCreateTeacherSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { allowDuplicate, ...data } = parsed.data

  if (!allowDuplicate) {
    const matches = await teacherGw.findPossibleDuplicates(scope.schoolId, data)
    if (matches.length > 0) return { created: false, reason: 'possibleDuplicate', matches }
  }

  const teacher = await create({ ...data, schoolId: scope.schoolId })
  if (typeof teacher === 'string') return teacher
  return { id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName }
}
