import type { z } from 'zod'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { createTeacherSchema } from './schemas'

type Input = z.infer<typeof createTeacherSchema>

export async function createTeacher(input: Input, teacherGw = teacherGateway) {
  const parsed = createTeacherSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, ...data } = parsed.data
  return teacherGw.create(schoolId, data)
}
