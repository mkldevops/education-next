import type { z } from 'zod'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { teacherLifecycleSchema } from './schemas'

type Input = z.infer<typeof teacherLifecycleSchema>

export async function archiveTeacher(input: Input, gateway = teacherGateway) {
  const parsed = teacherLifecycleSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  return gateway.archive(parsed.data.schoolId, parsed.data.id)
}
