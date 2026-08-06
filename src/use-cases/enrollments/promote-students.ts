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

export type SkipReason =
  | 'alreadyPromoted'
  | 'noClassAssignment'
  | 'noNextLevel'
  | 'noTargetClass'
  | 'targetClassFull'

export interface PromotionError {
  studentId: string
  reason: 'createFailed'
}

export interface PromotionResult {
  promoted: number
  skipped: number
  errors: PromotionError[]
}

export interface PromotionPreview {
  promoted: number
  skipped: number
  skippedByReason: Record<SkipReason, number>
}

interface TargetClassPeriod {
  id: string
  capacity: number
}

interface EligibilityContext {
  alreadyPromotedStudentIds: Set<string>
  targetClassPeriodByLevelId: Map<string, TargetClassPeriod>
  occupancyByClassPeriodId: Map<string, number>
}

type Eligibility =
  | { outcome: 'eligible'; targetClassPeriodId: string }
  | { outcome: 'skipped'; reason: SkipReason }

// Loads everything resolveEligibility needs in three batched queries (instead of two per
// student), and seeds an in-memory occupancy tally that both previewPromoteStudents and
// promoteStudents mutate identically as they walk the same enrollment list, so their totals
// cannot drift from each other.
async function buildEligibilityContext(
  enrollments: CompletedEnrollment[],
  targetPeriodId: string
): Promise<EligibilityContext> {
  const studentIds = enrollments.map((enrollment) => enrollment.studentId)
  const alreadyPromotedStudentIds = await enrollmentGateway.findEnrolledStudentIds(
    targetPeriodId,
    studentIds
  )

  const nextLevelIds = [
    ...new Set(
      enrollments.flatMap((enrollment) => {
        const nextLevel = enrollment.classAssignments[0]?.classPeriod.level.nextLevel
        return nextLevel?.isActive ? [nextLevel.id] : []
      })
    ),
  ]

  const targetClassPeriods =
    nextLevelIds.length === 0
      ? []
      : await db.classPeriod.findMany({
          where: { levelId: { in: nextLevelIds }, periodId: targetPeriodId, isActive: true },
          select: { id: true, levelId: true, capacity: true },
        })

  const targetClassPeriodByLevelId = new Map<string, TargetClassPeriod>()
  for (const classPeriod of targetClassPeriods) {
    if (!targetClassPeriodByLevelId.has(classPeriod.levelId)) {
      targetClassPeriodByLevelId.set(classPeriod.levelId, classPeriod)
    }
  }

  const classPeriodIds = targetClassPeriods.map((classPeriod) => classPeriod.id)
  const occupancyGroups =
    classPeriodIds.length === 0
      ? []
      : await db.classAssignment.groupBy({
          by: ['classPeriodId'],
          where: {
            classPeriodId: { in: classPeriodIds },
            endAt: null,
            enrollment: { status: { in: ['PENDING', 'ACTIVE', 'COMPLETED'] } },
          },
          _count: { _all: true },
        })

  const occupancyByClassPeriodId = new Map(
    occupancyGroups.map((group) => [group.classPeriodId, group._count._all])
  )

  return { alreadyPromotedStudentIds, targetClassPeriodByLevelId, occupancyByClassPeriodId }
}

function resolveEligibility(
  enrollment: CompletedEnrollment,
  context: EligibilityContext
): Eligibility {
  if (context.alreadyPromotedStudentIds.has(enrollment.studentId)) {
    return { outcome: 'skipped', reason: 'alreadyPromoted' }
  }

  const classAssignment = enrollment.classAssignments[0]
  if (!classAssignment) return { outcome: 'skipped', reason: 'noClassAssignment' }

  const nextLevel = classAssignment.classPeriod.level.nextLevel
  if (!nextLevel?.isActive) return { outcome: 'skipped', reason: 'noNextLevel' }

  const targetClassPeriod = context.targetClassPeriodByLevelId.get(nextLevel.id)
  if (!targetClassPeriod) return { outcome: 'skipped', reason: 'noTargetClass' }

  const currentOccupancy = context.occupancyByClassPeriodId.get(targetClassPeriod.id) ?? 0
  if (checkCapacity(targetClassPeriod.capacity, currentOccupancy) !== 'OK') {
    return { outcome: 'skipped', reason: 'targetClassFull' }
  }

  context.occupancyByClassPeriodId.set(targetClassPeriod.id, currentOccupancy + 1)
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
  const context = await buildEligibilityContext(enrollments, parsed.data.targetPeriodId)

  let promoted = 0
  const skippedByReason: Record<SkipReason, number> = {
    alreadyPromoted: 0,
    noClassAssignment: 0,
    noNextLevel: 0,
    noTargetClass: 0,
    targetClassFull: 0,
  }

  for (const enrollment of enrollments) {
    const eligibility = resolveEligibility(enrollment, context)
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
  const context = await buildEligibilityContext(enrollments, parsed.data.targetPeriodId)

  let promoted = 0
  let skipped = 0
  const errors: PromotionError[] = []

  // Each student is promoted in its own transaction: Postgres aborts the whole transaction after
  // any statement error, so one batch-wide transaction would make a partial report impossible —
  // a single failing student would roll back everyone and throw instead of returning errors.
  // Per-student transactions keep create + assign atomic without that blast radius.
  for (const enrollment of enrollments) {
    const eligibility = resolveEligibility(enrollment, context)

    if (eligibility.outcome === 'skipped') {
      skipped++
      continue
    }

    try {
      await db.$transaction(
        async (tx) => {
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
        },
        { timeout: 10000, maxWait: 5000 }
      )

      promoted++
    } catch (error) {
      console.error(`promoteStudents: failed to promote student ${enrollment.studentId}`, error)
      context.occupancyByClassPeriodId.set(
        eligibility.targetClassPeriodId,
        (context.occupancyByClassPeriodId.get(eligibility.targetClassPeriodId) ?? 1) - 1
      )
      errors.push({ studentId: enrollment.studentId, reason: 'createFailed' })
      skipped++
    }
  }

  return { promoted, skipped, errors } satisfies PromotionResult
}
