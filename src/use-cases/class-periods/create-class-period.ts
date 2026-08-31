import type { z } from 'zod'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { levelGateway } from '@/gateways/level-gateway'
import { periodGateway } from '@/gateways/period-gateway'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { createClassPeriodSchema } from './schemas'

type Input = z.input<typeof createClassPeriodSchema>

export async function createClassPeriod(
  input: Input,
  classPeriodGw = classPeriodGateway,
  levelGw = levelGateway,
  periodGw = periodGateway,
  teacherGw = teacherGateway
) {
  const parsed = createClassPeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, teacherIds, ...data } = parsed.data

  const level = await levelGw.findById(schoolId, data.levelId)
  if (!level) return 'levelNotFound' as const

  const period = await periodGw.findById(schoolId, data.periodId)
  if (!period) return 'periodNotFound' as const

  if (teacherIds.length > 0) {
    const teachers = await teacherGw.findByIds(schoolId, teacherIds)
    if (teachers.length !== teacherIds.length) return 'teacherNotFound' as const
  }

  const classPeriod = await classPeriodGw.create(schoolId, { ...data, teacherIds })
  return classPeriod
}
