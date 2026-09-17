import type { z } from 'zod'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { deactivateClassPeriodSchema } from './schemas'

type Input = z.infer<typeof deactivateClassPeriodSchema>

export async function deactivateClassPeriod(input: Input, classPeriodGw = classPeriodGateway) {
  const parsed = deactivateClassPeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  return classPeriodGw.deactivate(parsed.data.schoolId, parsed.data.id)
}
