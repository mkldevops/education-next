import type { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { periodGateway } from '@/gateways/period-gateway'
import { db } from '@/lib/db'
import { promoteStudentsSchema } from './schemas'

type Input = z.infer<typeof promoteStudentsSchema>
type CompletedEnrollment = Awaited<
  ReturnType<typeof enrollmentGateway.findCompletedByPeriod>
>[number]
type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]
type QueryClient = typeof db | TransactionClient

export type SkipReason = 'noClassAssignment' | 'noNextLevel' | 'noTargetClass' | 'targetClassFull'

type Eligibility =
  | { outcome: 'eligible'; targetClassPeriodId: string }
  | { outcome: 'skipped'; reason: SkipReason }

export interface PromotionResult {
  promoted: number
  skipped: number
  errors: string[]
}

export interface PromotionPreview {
  promoted: number
  skipped: number
  skippedByReason: Record<SkipReason, number>
}

async function resolveEligibility(
  enrollment: CompletedEnrollment,
  targetPeriodId: string,
  client: QueryClient
): Promise<Eligibility> {
  const classAssignment = enrollment.classAssignments[0]
  if (!classAssignment) return { outcome: 'skipped', reason: 'noClassAssignment' }

  const level = classAssignment.classPeriod.level
  const nextLevel = level.nextLevel
  if (!nextLevel?.isActive) return { outcome: 'skipped', reason: 'noNextLevel' }

  const targetClassPeriod = await client.classPeriod.findFirst({
    where: {
      levelId: nextLevel.id,
      periodId: targetPeriodId,
      isActive: true,
    },
  })
  if (!targetClassPeriod) return { outcome: 'skipped', reason: 'noTargetClass' }

  const enrolledCount = await client.classAssignment.count({
    where: {
      classPeriodId: targetClassPeriod.id,
      endAt: null,
      enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
    },
  })

  const capacityCheck = checkCapacity(targetClassPeriod.capacity, enrolledCount)
  if (capacityCheck !== 'OK') return { outcome: 'skipped', reason: 'targetClassFull' }

  return { outcome: 'eligible', targetClassPeriodId: targetClassPeriod.id }
}

export async function previewPromoteStudents(input: Input) {
  const parsed = promoteStudentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const sourcePeriod = await periodGateway.findById(parsed.data.sourcePeriodId)
  if (!sourcePeriod) return 'notFound' as const

  const targetPeriod = await periodGateway.findById(parsed.data.targetPeriodId)
  if (!targetPeriod) return 'notFound' as const

  const enrollments = await enrollmentGateway.findCompletedByPeriod(parsed.data.sourcePeriodId)

  let promoted = 0
  const skippedByReason: Record<SkipReason, number> = {
    noClassAssignment: 0,
    noNextLevel: 0,
    noTargetClass: 0,
    targetClassFull: 0,
  }

  for (const enrollment of enrollments) {
    const eligibility = await resolveEligibility(enrollment, parsed.data.targetPeriodId, db)
    if (eligibility.outcome === 'eligible') {
      promoted++
    } else {
      skippedByReason[eligibility.reason]++
    }
  }

  const skipped = Object.values(skippedByReason).reduce((sum, count) => sum + count, 0)

  return { promoted, skipped, skippedByReason } satisfies PromotionPreview
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
      const eligibility = await resolveEligibility(enrollment, parsed.data.targetPeriodId, tx)

      if (eligibility.outcome === 'skipped') {
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
            classPeriodId: eligibility.targetClassPeriodId,
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
