import type { z } from 'zod'
import { checkCapacity, SEAT_HOLDING_ENROLLMENT_STATUSES } from '@/domain/class-period'
import { reserveClassSeats } from '@/gateways/class-seat-lock'
import type { CompletedEnrollment } from '@/gateways/enrollment-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { periodGateway } from '@/gateways/period-gateway'
import { db } from '@/lib/db'
import { promoteStudentsSchema } from './schemas'

type Input = z.infer<typeof promoteStudentsSchema>

export type SkipReason =
  | 'alreadyPromoted'
  | 'noClassAssignment'
  | 'noNextLevel'
  | 'noTargetClass'
  | 'targetClassFull'

interface PromotionError {
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
  schoolId: string,
  enrollments: CompletedEnrollment[],
  targetPeriodId: string
): Promise<EligibilityContext> {
  const studentIds = enrollments.map((enrollment) => enrollment.studentId)
  const alreadyPromotedStudentIds = await enrollmentGateway.findEnrolledStudentIds(
    schoolId,
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
          where: {
            schoolId,
            levelId: { in: nextLevelIds },
            periodId: targetPeriodId,
            isActive: true,
          },
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
            schoolId,
            classPeriodId: { in: classPeriodIds },
            endAt: null,
            enrollment: { status: { in: [...SEAT_HOLDING_ENROLLMENT_STATUSES] } },
          },
          _count: { _all: true },
        })

  const occupancyByClassPeriodId = new Map(
    occupancyGroups.map((group) => [group.classPeriodId, group._count._all])
  )

  return { alreadyPromotedStudentIds, targetClassPeriodByLevelId, occupancyByClassPeriodId }
}

async function loadPromotion(input: Input) {
  const parsed = promoteStudentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, sourcePeriodId, targetPeriodId } = parsed.data

  if (!(await periodGateway.findById(schoolId, sourcePeriodId))) return 'notFound' as const
  if (!(await periodGateway.findById(schoolId, targetPeriodId))) return 'notFound' as const

  const enrollments = await enrollmentGateway.findCompletedByPeriod(schoolId, sourcePeriodId)
  const context = await buildEligibilityContext(schoolId, enrollments, targetPeriodId)
  return { schoolId, targetPeriodId, enrollments, context }
}

/**
 * Réserve une place et marque l'élève promu dans `context` quand il est éligible : à appeler une
 * seule fois par inscription.
 */
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
  context.alreadyPromotedStudentIds.add(enrollment.studentId)
  return { outcome: 'eligible', targetClassPeriodId: targetClassPeriod.id }
}

export async function previewPromoteStudents(input: Input) {
  const loaded = await loadPromotion(input)
  if (typeof loaded === 'string') return loaded
  const { enrollments, context } = loaded

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

type PromotionOutcome = 'promoted' | SkipReason

/** Rend à la classe la place réservée par `resolveEligibility` quand rien n'a été écrit. */
function releaseSeat(context: EligibilityContext, classPeriodId: string) {
  const occupancy = context.occupancyByClassPeriodId.get(classPeriodId) ?? 1
  context.occupancyByClassPeriodId.set(classPeriodId, occupancy - 1)
}

export async function promoteStudents(input: Input) {
  const loaded = await loadPromotion(input)
  if (typeof loaded === 'string') return loaded
  const { schoolId, targetPeriodId, enrollments, context } = loaded

  let promoted = 0
  let skipped = 0
  const errors: PromotionError[] = []

  // Each student is promoted in its own transaction: Postgres aborts the whole transaction after
  // any statement error, so one batch-wide transaction would make a partial report impossible —
  // a single failing student would roll back everyone and throw instead of returning errors.
  // Per-student transactions keep create + assign atomic without that blast radius.
  //
  // The in-memory eligibility above is only a pre-filter, read before the loop and outside any
  // lock. Each transaction re-checks, under the (school, student, target period) lock and the
  // target class row lock, that the student is still unenrolled and that a seat is still free:
  // a second run (double click, two admins) creates nothing and never overfills a class.
  for (const enrollment of enrollments) {
    const eligibility = resolveEligibility(enrollment, context)

    if (eligibility.outcome === 'skipped') {
      skipped++
      continue
    }

    const { targetClassPeriodId } = eligibility

    try {
      const outcome = await db.$transaction(
        async (tx): Promise<PromotionOutcome> => {
          const { studentId } = enrollment
          await enrollmentGateway.lockStudentInPeriod(tx, schoolId, studentId, targetPeriodId)
          if (await enrollmentGateway.isEnrolledInPeriod(tx, schoolId, studentId, targetPeriodId)) {
            return 'alreadyPromoted'
          }

          const seats = await reserveClassSeats(tx, schoolId, targetClassPeriodId)
          if (seats === 'classFull') return 'targetClassFull'
          if (seats === 'notFound') return 'noTargetClass'

          const newEnrollment = await tx.enrollment.create({
            data: {
              schoolId,
              studentId,
              planId: enrollment.planId,
              totalAmount: enrollment.totalAmount,
              discount: enrollment.discount,
              canLeaveAlone: enrollment.canLeaveAlone,
              status: 'PENDING',
            },
          })

          await tx.classAssignment.create({
            data: {
              schoolId,
              enrollmentId: newEnrollment.id,
              classPeriodId: targetClassPeriodId,
              startAt: new Date(),
            },
          })

          return 'promoted'
        },
        { timeout: 10000, maxWait: 5000 }
      )

      if (outcome === 'promoted') {
        promoted++
      } else {
        releaseSeat(context, targetClassPeriodId)
        skipped++
      }
    } catch (error) {
      console.error(`promoteStudents: failed to promote student ${enrollment.studentId}`, error)
      releaseSeat(context, targetClassPeriodId)
      errors.push({ studentId: enrollment.studentId, reason: 'createFailed' })
      skipped++
    }
  }

  return { promoted, skipped, errors } satisfies PromotionResult
}
