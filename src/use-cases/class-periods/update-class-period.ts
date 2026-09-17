import type { z } from 'zod'
import { validateCapacityUpdate } from '@/domain/class-period'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { levelGateway } from '@/gateways/level-gateway'
import { teacherGateway } from '@/gateways/teacher-gateway'
import { updateClassPeriodSchema } from './schemas'

type Input = z.infer<typeof updateClassPeriodSchema>

export async function updateClassPeriod(
  input: Input,
  classPeriodGw = classPeriodGateway,
  teacherGw = teacherGateway,
  levelGw = levelGateway
) {
  const parsed = updateClassPeriodSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, teacherIds, ...updateData } = parsed.data

  const classPeriod = await classPeriodGw.findById(schoolId, id)
  if (!classPeriod) return 'notFound' as const

  if (updateData.levelId !== undefined && updateData.levelId !== classPeriod.levelId) {
    const level = await levelGw.findById(schoolId, updateData.levelId)
    if (!level) return 'levelNotFound' as const

    const existingClassPeriod = await classPeriodGw.findByLevelAndPeriod(
      schoolId,
      updateData.levelId,
      classPeriod.periodId
    )
    if (existingClassPeriod) return 'levelAlreadyAssigned' as const
  }

  if (updateData.capacity !== undefined) {
    const enrolled = await classPeriodGw.countEnrolled(schoolId, id)
    const capacityCheck = validateCapacityUpdate(updateData.capacity, enrolled)
    if (capacityCheck !== 'OK') return capacityCheck
  }

  if (teacherIds !== undefined && teacherIds.length > 0) {
    const teachers = await teacherGw.findByIds(schoolId, teacherIds)
    if (teachers.length !== teacherIds.length) return 'teacherNotFound' as const
  }

  const data = teacherIds === undefined ? updateData : { ...updateData, teacherIds }
  const updated = await classPeriodGw.update(schoolId, id, data)
  return updated
}
