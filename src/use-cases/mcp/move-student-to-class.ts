import type { z } from 'zod'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { reassignClass } from '@/use-cases/enrollments/reassign-class'
import { mcpMoveStudentToClassSchema } from './schemas'

type Input = z.input<typeof mcpMoveStudentToClassSchema>

const defaultDeps = {
  reassign: reassignClass,
  findOpen: enrollmentGateway.findOpenForMcp,
}

/**
 * `move_student_to_class` : le changement de classe du tableau de bord (`reassignClass`),
 * mêmes règles et mêmes refus. Le `schoolId` vient de la portée ; une inscription ou une
 * classe d'une autre école se lit comme absente (`notFound`).
 *
 * Désignée par le nom de l'élève, l'inscription doit être la seule ouverte qui corresponde :
 * plusieurs candidates rendent `ambiguousEnrollment`, l'identifiant se lit alors dans
 * `find_students`.
 */
export async function moveStudentToClassFromMcp(
  scope: { schoolId: string },
  input: Input,
  deps = defaultDeps
) {
  const parsed = mcpMoveStudentToClassSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  const { enrollmentId, studentName, studentLastname, classPeriodId } = parsed.data

  let id = enrollmentId
  if (!id) {
    const candidates = await deps.findOpen(schoolId, {
      name: studentName ?? '',
      lastname: studentLastname ?? '',
    })
    if (candidates.length === 0) return 'notFound' as const
    if (candidates.length > 1) return 'ambiguousEnrollment' as const
    id = candidates[0].id
  }

  const result = await deps.reassign({
    schoolId,
    enrollmentId: id,
    newClassPeriodId: classPeriodId,
  })
  if (result !== 'OK') return result

  // Le serveur MCP lit toute chaîne comme un refus : le succès est un objet.
  return { enrollmentId: id, classPeriodId }
}
