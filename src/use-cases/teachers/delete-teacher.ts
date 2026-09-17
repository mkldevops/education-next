import type { z } from 'zod'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { teacherLifecycleSchema } from './schemas'

type Input = z.infer<typeof teacherLifecycleSchema>

export async function deleteTeacher(input: Input, gateway = teacherGateway) {
  const parsed = teacherLifecycleSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  return gateway.delete(parsed.data.schoolId, parsed.data.id)
}
