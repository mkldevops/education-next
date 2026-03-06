import type { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { periodGateway } from '@/gateways/period-gateway'
import { db } from '@/lib/db'
import { promoteStudentsSchema } from './schemas'

type Input = z.infer<typeof promoteStudentsSchema>

export interface PromotionResult {
  promoted: number
  skipped: number
  errors: string[]
}

export async function promoteStudents(input: Input) {
  const parsed = promoteStudentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const sourcePeriod = await periodGateway.findById(parsed.data.sourcePeriodId)
  if (!sourcePeriod) return 'notFound' as const

  const targetPeriod = await periodGateway.findById(parsed.data.targetPeriodId)
  if (!targetPeriod) return 'notFound' as const

  const enrollments = await enrollmentGateway.findCompletedByPeriod(parsed.data.sourcePeriodId)

  const result = await db.$transaction(async (tx) => {
    let promoted = 0
    let skipped = 0
    const errors: string[] = []

    for (const enrollment of enrollments) {
      const classAssignment = enrollment.classAssignments[0]
      if (!classAssignment) {
        skipped++
        continue
      }

      const level = classAssignment.classPeriod.level
      const nextLevel = level.nextLevel

      if (!nextLevel) {
        skipped++
        continue
      }

      if (!nextLevel.isActive) {
        skipped++
        continue
      }

      const targetClassPeriod = await tx.classPeriod.findFirst({
        where: {
          levelId: nextLevel.id,
          periodId: parsed.data.targetPeriodId,
          isActive: true,
        },
      })

      if (!targetClassPeriod) {
        skipped++
        continue
      }

      const enrolledCount = await tx.classAssignment.count({
        where: {
          classPeriodId: targetClassPeriod.id,
          endAt: null,
          enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
        },
      })

      const capacityCheck = checkCapacity(targetClassPeriod.capacity, enrolledCount)
      if (capacityCheck !== 'OK') {
        skipped++
        continue
      }

      try {
        const newEnrollment = await tx.enrollment.create({
          data: {
            studentId: enrollment.studentId,
            planId: enrollment.planId,
            totalAmount: enrollment.totalAmount,
            discount: enrollment.discount,
            canLeaveAlone: enrollment.canLeaveAlone,
            status: 'PENDING',
          },
        })

        await tx.classAssignment.create({
          data: {
            enrollmentId: newEnrollment.id,
            classPeriodId: targetClassPeriod.id,
            startAt: new Date(),
          },
        })

        promoted++
      } catch (error) {
        errors.push(
          `Failed to promote student ${enrollment.studentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        skipped++
      }
    }

    return { promoted, skipped, errors } as PromotionResult
  })

  return result
}
