import type { z } from 'zod'
import { assignClassPeriodTeacher } from '@/use-cases/class-periods/assign-teacher'
import type { mcpAssignTeacherSchema } from './schemas'

type Input = z.infer<typeof mcpAssignTeacherSchema>

/**
 * Le `schoolId` vient de la portée, jamais de l'agent : une classe ou un enseignant d'une
 * autre école se lit comme absent (`notFound`, `teacherNotFound`).
 */
export function assignTeacherFromMcp(
  scope: { schoolId: string },
  input: Input,
  assign = assignClassPeriodTeacher
) {
  return assign({ schoolId: scope.schoolId, id: input.classPeriodId, teacherId: input.teacherId })
}
