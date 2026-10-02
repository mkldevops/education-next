import type { z } from 'zod'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { assignClassPeriodTeacherSchema } from './schemas'

type Input = z.infer<typeof assignClassPeriodTeacherSchema>

/**
 * Affecte un enseignant actif à une classe de l'école, en plus de ceux qu'elle a déjà.
 * Une affectation existante n'est pas une erreur : rejouer l'appel rend `alreadyAssigned`.
 */
export async function assignClassPeriodTeacher(
  input: Input,
  classPeriodGw: Pick<typeof classPeriodGateway, 'findById' | 'assignTeacher'> = classPeriodGateway,
  teacherGw: Pick<typeof teacherGateway, 'findByIds'> = teacherGateway
) {
  const parsed = assignClassPeriodTeacherSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, teacherId } = parsed.data

  const classPeriod = await classPeriodGw.findById(schoolId, id)
  if (!classPeriod) return 'notFound' as const

  const teachers = await teacherGw.findByIds(schoolId, [teacherId])
  if (teachers.length === 0) return 'teacherNotFound' as const

  const created = await classPeriodGw.assignTeacher(schoolId, id, teacherId)
  return { classPeriodId: id, teacherId, alreadyAssigned: !created }
}
