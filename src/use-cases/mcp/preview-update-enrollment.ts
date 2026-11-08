import type { z } from 'zod'
import { calculateTotalAmount, pricingFromTotalAmount, validateDiscount } from '@/domain/enrollment'
import type { McpFinding } from '@/domain/mcp-draft'
import { startMonthFromDate } from '@/domain/payment-schedule'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { roundHalfUp } from '@/lib/decimal'
import { resolveOwedPlanAmount } from '@/use-cases/enrollments/pricing'
import { blockedPreview, saveDraftPreview } from './draft-response'
import type { DraftScope } from './draft-scope'
import { matchByName } from './match-by-name'
import { previewUpdateEnrollmentSchema } from './schemas'

// `z.input`, pas `z.infer` : l'entrée vient d'un modèle et traverse le schéma — un défaut
// y est absent.
type Input = z.input<typeof previewUpdateEnrollmentSchema>

type Candidate = Awaited<ReturnType<typeof enrollmentGateway.findOpenForMcp>>[number]

export const UPDATE_ENROLLMENT_TOOL = 'update_enrollment'

export function paidAmount(
  payments: ReadonlyArray<{ amount: { toString(): string } | number }>
): number {
  return roundHalfUp(payments.reduce((sum, payment) => sum + Number(payment.amount), 0))
}

function describe(enrollment: Candidate) {
  return {
    id: enrollment.id,
    student: `${enrollment.student.person.name} ${enrollment.student.person.lastname}`,
    status: enrollment.status,
    classes: enrollment.classAssignments.map((assignment) => assignment.classPeriod.name),
    plan: enrollment.plan.name,
  }
}

export async function previewUpdateEnrollment(scope: DraftScope, input: Input) {
  const parsed = previewUpdateEnrollmentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  // Défense en profondeur : l'outil n'est déjà pas déclaré quand le drapeau est coupé,
  // mais un appel direct par nom ne doit ni lire une inscription ni proposer de brouillon.
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const { schoolId } = scope
  const data = parsed.data

  const blockers: McpFinding[] = []
  const warnings: McpFinding[] = []

  const candidates = await enrollmentGateway.findOpenForMcp(
    schoolId,
    data.enrollmentId
      ? { id: data.enrollmentId }
      : { name: data.studentName ?? '', lastname: data.studentLastname ?? '' }
  )
  const matches = { enrollments: candidates.map(describe) }
  const nothing = blockedPreview(matches, warnings, blockers)

  if (candidates.length !== 1) {
    blockers.push({
      field: data.enrollmentId ? 'enrollmentId' : 'studentName',
      value: data.enrollmentId ?? `${data.studentName} ${data.studentLastname}`,
      reason: candidates.length === 0 ? 'notFound' : 'ambiguousEnrollment',
    })
    return nothing
  }

  const enrollment = candidates[0]
  const before = {
    plan: {
      id: enrollment.plan.id,
      name: enrollment.plan.name,
      amount: Number(enrollment.plan.amount),
    },
    discount: Number(enrollment.discount),
    totalAmount: Number(enrollment.totalAmount),
    startMonth: startMonthFromDate(enrollment.startMonth),
  }

  let plan = before.plan
  let paymentSchedule: unknown = enrollment.plan.paymentSchedule
  if (data.planName) {
    const found = matchByName(await mcpReadGateway.listPlans(schoolId), data.planName)
    if (found.length !== 1) {
      blockers.push({
        field: 'planName',
        value: data.planName,
        reason: found.length === 0 ? 'unknownPlan' : 'ambiguousPlan',
      })
      return nothing
    }
    plan = { id: found[0].id, name: found[0].name, amount: Number(found[0].amount) }
    paymentSchedule = found[0].paymentSchedule
  }

  // Le mois de début suit l'inscription quand il n'est pas fourni : changer de formule ou
  // de remise garde le prorata déjà décidé.
  const startMonth = data.startMonth === undefined ? before.startMonth : data.startMonth

  // Sans remise lue, celle de l'inscription suit la nouvelle formule : changer de forfait
  // ne doit pas effacer en silence une remise accordée.
  let discount = data.discount ?? before.discount
  let changedField: 'totalAmount' | 'planName' | 'discount' | 'startMonth'
  let changedValue: string
  if (data.totalAmount !== undefined) {
    changedField = 'totalAmount'
    changedValue = String(data.totalAmount)
  } else if (data.discount !== undefined) {
    changedField = 'discount'
    changedValue = String(discount)
  } else if (data.planName !== undefined) {
    changedField = 'planName'
    changedValue = plan.name
  } else {
    changedField = 'startMonth'
    changedValue = String(startMonth)
  }

  // La part de la formule due à partir du mois de début remplace son prix dans les règles
  // de total ci-dessous ; sans mois de début, c'est le prix de la formule.
  const planAmountDue = await resolveOwedPlanAmount(
    schoolId,
    enrollment.id,
    { amount: plan.amount, paymentSchedule },
    startMonth
  )
  if (typeof planAmountDue === 'string') {
    blockers.push({
      field: data.startMonth === undefined ? changedField : 'startMonth',
      value: data.startMonth === undefined ? changedValue : String(startMonth),
      reason: planAmountDue,
    })
    return nothing
  }

  if (data.totalAmount !== undefined) {
    const pricing = pricingFromTotalAmount(planAmountDue, data.totalAmount)
    if (typeof pricing === 'string') {
      blockers.push({
        field: 'totalAmount',
        value: String(data.totalAmount),
        reason: pricing,
      })
      return nothing
    }
    discount = pricing.discount
  }

  if (validateDiscount(planAmountDue, discount) !== 'OK') {
    blockers.push({ field: 'discount', value: String(discount), reason: 'discountExceedsPlan' })
    return nothing
  }

  const totalAmount = data.totalAmount ?? calculateTotalAmount(planAmountDue, discount)
  const paid = paidAmount(enrollment.payments)

  // Un total recalculé ne se compare pas au total stocké seul : une formule dont le prix a
  // changé depuis l'inscription rend un recalcul réel même à formule et remise égales.
  if (
    plan.id === before.plan.id &&
    discount === before.discount &&
    totalAmount === before.totalAmount &&
    startMonth === before.startMonth
  ) {
    blockers.push({ field: changedField, value: changedValue, reason: 'noChange' })
    return nothing
  }

  // Le solde ne descend jamais sous zéro : un total inférieur à ce qui est déjà encaissé
  // ferait disparaître un trop-perçu que personne n'a décidé de rembourser.
  if (paid > totalAmount) {
    blockers.push({ field: changedField, value: changedValue, reason: 'totalBelowPaid' })
    return nothing
  }

  const resolved = {
    tool: UPDATE_ENROLLMENT_TOOL,
    enrollment: describe(enrollment),
    before,
    after: { plan, discount, totalAmount, startMonth, planAmountDue },
    paid,
    remaining: roundHalfUp(totalAmount - paid),
  }

  return saveDraftPreview(scope, UPDATE_ENROLLMENT_TOOL, resolved, matches, warnings, blockers)
}
