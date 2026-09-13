import type { z } from 'zod'
import { calculateTotalAmount, validateDiscount } from '@/domain/enrollment'
import { draftExpiry, type McpFinding } from '@/domain/mcp-draft'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { roundHalfUp } from '@/lib/decimal'
import { draftChecksum } from '@/lib/mcp-draft-crypto'
import { matchByName } from './match-by-name'
import type { McpScope } from './resolve-mcp-scope'
import { previewUpdateEnrollmentSchema } from './schemas'

// `z.input`, pas `z.infer` : l'entrée vient d'un modèle et traverse le schéma — un défaut
// y est absent.
type Input = z.input<typeof previewUpdateEnrollmentSchema>

type Candidate = Awaited<ReturnType<typeof enrollmentGateway.findOpenForMcp>>[number]

export const UPDATE_ENROLLMENT_TOOL = 'update_enrollment'

function describe(enrollment: Candidate) {
  return {
    id: enrollment.id,
    student: `${enrollment.student.person.name} ${enrollment.student.person.lastname}`,
    status: enrollment.status,
    classes: enrollment.classAssignments.map((assignment) => assignment.classPeriod.name),
    plan: enrollment.plan.name,
  }
}

export async function previewUpdateEnrollment(scope: McpScope, input: Input) {
  const parsed = previewUpdateEnrollmentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
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
  const nothing = { draftId: null, checksum: null, plan: null, matches, warnings, blockers }

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
  }

  let plan = before.plan
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
  }

  // Sans remise lue, celle de l'inscription suit la nouvelle formule : changer de forfait
  // ne doit pas effacer en silence une remise accordée.
  const discount = data.discount ?? before.discount
  const changedField = data.discount === undefined ? 'planName' : 'discount'
  const changedValue = data.discount === undefined ? plan.name : String(discount)

  if (validateDiscount(plan.amount, discount) !== 'OK') {
    blockers.push({ field: 'discount', value: String(discount), reason: 'discountExceedsPlan' })
    return nothing
  }

  const totalAmount = calculateTotalAmount(plan.amount, discount)
  const paid = roundHalfUp(
    enrollment.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  )

  // Un total recalculé ne se compare pas au total stocké seul : une formule dont le prix a
  // changé depuis l'inscription rend un recalcul réel même à formule et remise égales.
  if (
    plan.id === before.plan.id &&
    discount === before.discount &&
    totalAmount === before.totalAmount
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
    after: { plan, discount, totalAmount },
    paid,
    remaining: roundHalfUp(totalAmount - paid),
  }

  const checksum = draftChecksum(resolved)
  const draft = await mcpDraftGateway.create(schoolId, {
    keyId: scope.keyId,
    tool: UPDATE_ENROLLMENT_TOOL,
    checksum,
    resolved,
    expiresAt: draftExpiry(),
  })

  return { draftId: draft.id, checksum, plan: resolved, matches, warnings, blockers }
}
