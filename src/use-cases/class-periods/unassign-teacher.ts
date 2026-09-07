import type { z } from 'zod'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { unassignClassPeriodTeacherSchema } from './schemas'

type Input = z.infer<typeof unassignClassPeriodTeacherSchema>

export async function unassignClassPeriodTeacher(input: Input, classPeriodGw = classPeriodGateway) {
  const parsed = unassignClassPeriodTeacherSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, teacherId } = parsed.data

  const classPeriod = await classPeriodGw.findById(schoolId, id)
  if (!classPeriod) return 'notFound' as const

  const removed = await classPeriodGw.unassignTeacher(schoolId, id, teacherId)
  if (!removed) return 'assignmentNotFound' as const

  return 'OK' as const
}
