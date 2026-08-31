import type { z } from 'zod'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { updateTeacherSchema } from './schemas'

type Input = z.infer<typeof updateTeacherSchema>

export async function updateTeacher(input: Input, teacherGw = teacherGateway) {
  const parsed = updateTeacherSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, ...data } = parsed.data
  const teacher = await teacherGw.findById(schoolId, id)
  if (!teacher) return 'notFound' as const

  return teacherGw.update(schoolId, id, data)
}
