import type { z } from 'zod'
import { checkCapacity, SEAT_HOLDING_ENROLLMENT_STATUSES } from '@/domain/class-period'
import { reserveClassSeats } from '@/gateways/class-seat-lock'
import type { CompletedEnrollment } from '@/gateways/enrollment-gateway'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { periodGateway } from '@/gateways/period-gateway'
import { db } from '@/lib/db'
import { promoteStudentsSchema } from './schemas'

type Input = z.input<typeof promoteStudentsSchema>

export type SkipReason =
  | 'alreadyPromoted'
  | 'planArchived'
  | 'noClassAssignment'
  | 'noNextLevel'
  | 'nextLevelNotChosen'
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

/** Élève dont le niveau mène à plusieurs niveaux : l'administrateur choisit le sien. */
export interface PromotionOrientation {
  enrollmentId: string
  studentName: string
  levelName: string
  nextLevels: Array<{ id: string; name: string }>
}

export interface PromotionPreview {
  promoted: number
  skipped: number
  skippedByReason: Record<SkipReason, number>
  orientations: PromotionOrientation[]
}

interface TargetClassPeriod {
  id: string
  capacity: number
}

interface EligibilityContext {
  nextLevelChoices: Record<string, string>
  alreadyPromotedStudentIds: Set<string>
  activePlanIds: Set<string>
  targetClassPeriodByLevelId: Map<string, TargetClassPeriod>
  occupancyByClassPeriodId: Map<string, number>
}

type Eligibility =
  | { outcome: 'eligible'; targetClassPeriodId: string }
  | { outcome: 'skipped'; reason: SkipReason }

// Loads everything resolveEligibility needs in four batched queries (instead of several per
// student), and seeds an in-memory occupancy tally that both previewPromoteStudents and
// promoteStudents mutate identically as they walk the same enrollment list, so their totals
// cannot drift from each other.
function activeNextLevels(enrollment: CompletedEnrollment) {
  const level = enrollment.classAssignments[0]?.classPeriod.level
  return (level?.nextLevels ?? [])
    .map(({ nextLevel }) => nextLevel)
    .filter((nextLevel) => nextLevel.isActive)
}

async function buildEligibilityContext(
  schoolId: string,
  enrollments: CompletedEnrollment[],
  targetPeriodId: string,
  nextLevelChoices: Record<string, string>
): Promise<EligibilityContext> {
  const studentIds = enrollments.map((enrollment) => enrollment.studentId)
  const alreadyPromotedStudentIds = await enrollmentGateway.findEnrolledStudentIds(
    schoolId,
    targetPeriodId,
    studentIds
  )

  // The new enrollment is born PENDING, so it must carry a selectable plan: a COMPLETED source
  // may legitimately keep an archived one (see business rules, Plans), the copy may not.
  const planIds = [...new Set(enrollments.map((enrollment) => enrollment.planId))]
  const activePlans =
    planIds.length === 0
      ? []
      : await db.plan.findMany({
          where: { schoolId, id: { in: planIds }, isActive: true },
          select: { id: true },
        })
  const activePlanIds = new Set(activePlans.map((plan) => plan.id))

  const nextLevelIds = [
    ...new Set(
      enrollments.flatMap((enrollment) => activeNextLevels(enrollment).map((level) => level.id))
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

  return {
    nextLevelChoices,
    alreadyPromotedStudentIds,
    activePlanIds,
    targetClassPeriodByLevelId,
    occupancyByClassPeriodId,
  }
}

async function loadPromotion(input: Input) {
  const parsed = promoteStudentsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, sourcePeriodId, targetPeriodId, nextLevelChoices } = parsed.data

  if (!(await periodGateway.findById(schoolId, sourcePeriodId))) return 'notFound' as const
  if (!(await periodGateway.findById(schoolId, targetPeriodId))) return 'notFound' as const

  const enrollments = await enrollmentGateway.findCompletedByPeriod(schoolId, sourcePeriodId)
  const context = await buildEligibilityContext(
    schoolId,
    enrollments,
    targetPeriodId,
    nextLevelChoices
  )
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

  if (!context.activePlanIds.has(enrollment.planId)) {
    return { outcome: 'skipped', reason: 'planArchived' }
  }

  const classAssignment = enrollment.classAssignments[0]
  if (!classAssignment) return { outcome: 'skipped', reason: 'noClassAssignment' }

  const nextLevel = resolveNextLevel(enrollment, context)
  if (nextLevel === 'none') return { outcome: 'skipped', reason: 'noNextLevel' }
  if (nextLevel === 'notChosen') return { outcome: 'skipped', reason: 'nextLevelNotChosen' }

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

/**
 * Un seul niveau suivant actif : il s'impose. Plusieurs : seul le choix fait pour l'inscription
 * compte, et il doit désigner l'un d'eux — un identifiant étranger vaut une absence de choix.
 */
function resolveNextLevel(
  enrollment: CompletedEnrollment,
  context: EligibilityContext
): { id: string } | 'none' | 'notChosen' {
  const nextLevels = activeNextLevels(enrollment)
  if (nextLevels.length === 0) return 'none'
  if (nextLevels.length === 1) return nextLevels[0]

  const chosenId = context.nextLevelChoices[enrollment.id]
  return nextLevels.find((level) => level.id === chosenId) ?? 'notChosen'
}

function toOrientation(enrollment: CompletedEnrollment): PromotionOrientation | null {
  const nextLevels = activeNextLevels(enrollment)
  const level = enrollment.classAssignments[0]?.classPeriod.level
  if (!level || nextLevels.length < 2) return null

  const { person } = enrollment.student
  return {
    enrollmentId: enrollment.id,
    studentName: `${person.name} ${person.lastname}`,
    levelName: level.name,
    nextLevels: nextLevels
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export async function previewPromoteStudents(input: Input) {
  const loaded = await loadPromotion(input)
  if (typeof loaded === 'string') return loaded
  const { enrollments, context } = loaded

  let promoted = 0
  const skippedByReason: Record<SkipReason, number> = {
    alreadyPromoted: 0,
    planArchived: 0,
    noClassAssignment: 0,
    noNextLevel: 0,
    nextLevelNotChosen: 0,
    noTargetClass: 0,
    targetClassFull: 0,
  }

  const orientations: PromotionOrientation[] = []
  for (const enrollment of enrollments) {
    const eligibility = resolveEligibility(enrollment, context)
    const isOrientable =
      eligibility.outcome === 'eligible' ||
      ['nextLevelNotChosen', 'noTargetClass', 'targetClassFull'].includes(eligibility.reason)
    const orientation = isOrientable ? toOrientation(enrollment) : null
    if (orientation) orientations.push(orientation)

    if (eligibility.outcome === 'eligible') {
      promoted++
    } else {
      skippedByReason[eligibility.reason]++
    }
  }

  const skipped = Object.values(skippedByReason).reduce((sum, count) => sum + count, 0)

  orientations.sort((a, b) => a.studentName.localeCompare(b.studentName))

  return { promoted, skipped, skippedByReason, orientations } satisfies PromotionPreview
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

          // Re-read before taking the class row lock: a plan archived between the pre-filter and
          // this transaction must not be attached to an open enrollment, nor hold a seat for nothing.
          const plan = await tx.plan.findFirst({
            where: { id: enrollment.planId, schoolId, isActive: true },
            select: { id: true },
          })
          if (!plan) return 'planArchived'

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
