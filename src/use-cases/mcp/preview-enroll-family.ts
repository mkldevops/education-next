import type { z } from 'zod'
import { checkCapacity } from '@/domain/class-period'
import { calculateTotalAmount, validateDiscount } from '@/domain/enrollment'
import { validateFamilyName } from '@/domain/family'
import { draftExpiry, type McpFinding } from '@/domain/mcp-draft'
import { distributePayment } from '@/domain/payment'
import { validateStudentBirthday } from '@/domain/student'
import { classPeriodGateway } from '@/gateways/class-period-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { personGateway } from '@/gateways/person-gateway'
import { draftChecksum } from '@/lib/mcp-draft-crypto'
import { listClassPeriods } from '../class-periods/list-class-periods'
import { listPlans } from '../plans/list-plans'
import type { McpScope } from './resolve-mcp-scope'
import { previewEnrollFamilySchema } from './schemas'

// `z.input`, pas `z.infer` : l'entrée vient d'un modèle et traverse la coercition du
// schéma — une date y arrive en chaîne, un défaut y est absent.
type Input = z.input<typeof previewEnrollFamilySchema>

export const ENROLL_FAMILY_TOOL = 'enroll_family'

/**
 * Résolution d'un libellé lu sur papier. L'égalité insensible à la casse d'abord, puis
 * une seule passe par sous-chaîne : « C4 » doit atteindre « C4 — Arabe débutant », mais
 * deux candidats restants sont une ambiguïté à rendre à l'humain, pas à trancher.
 */
function matchByName<T extends { name: string }>(rows: T[], label: string): T[] {
  const wanted = label.trim().toLowerCase()
  const exact = rows.filter((row) => row.name.trim().toLowerCase() === wanted)
  if (exact.length > 0) return exact
  return rows.filter((row) => row.name.toLowerCase().includes(wanted))
}

export async function previewEnrollFamily(scope: McpScope, input: Input) {
  const parsed = previewEnrollFamilySchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  const data = parsed.data

  const blockers: McpFinding[] = []
  const warnings: McpFinding[] = []

  if (validateFamilyName(data.familyName) !== 'OK') {
    blockers.push({ field: 'familyName', value: data.familyName, reason: 'invalidFamilyName' })
  }

  for (const [index, student] of data.students.entries()) {
    if (validateStudentBirthday(student.birthday) !== 'OK') {
      blockers.push({
        field: `students.${index}.birthday`,
        value: student.birthday.toISOString(),
        reason: 'birthdayNotInThePast',
      })
    }
  }

  const [classPeriods, plans] = await Promise.all([listClassPeriods(schoolId), listPlans(schoolId)])

  const classMatches = matchByName(classPeriods, data.className)
  if (classMatches.length !== 1) {
    blockers.push({
      field: 'className',
      value: data.className,
      reason: classMatches.length === 0 ? 'unknownClass' : 'ambiguousClass',
    })
  }

  const planMatches = matchByName(plans, data.planName)
  if (planMatches.length !== 1) {
    blockers.push({
      field: 'planName',
      value: data.planName,
      reason: planMatches.length === 0 ? 'unknownPlan' : 'ambiguousPlan',
    })
  }

  const classPeriod = classMatches.length === 1 ? classMatches[0] : null
  const plan = planMatches.length === 1 ? planMatches[0] : null
  const planAmount = plan ? Number(plan.amount) : 0

  if (plan && validateDiscount(planAmount, data.discount) !== 'OK') {
    blockers.push({
      field: 'discount',
      value: String(data.discount),
      reason: 'discountExceedsPlan',
    })
  }

  const totalAmount = calculateTotalAmount(planAmount, data.discount)

  if (classPeriod) {
    const enrolled = await classPeriodGateway.countEnrolled(schoolId, classPeriod.id)
    const capacity = checkCapacity(classPeriod.capacity, enrolled + data.students.length - 1)
    if (capacity !== 'OK') {
      blockers.push({
        field: 'className',
        value: classPeriod.name,
        reason: 'classFull',
      })
    }
  }

  // La répartition est calculée ici, pas au commit : les inscriptions n'existent pas
  // encore, donc elle est indexée sur la position de l'élève dans la demande.
  let allocation: Array<{ studentIndex: number; amount: number }> = []
  if (data.payment && plan) {
    const distribution = distributePayment(
      data.payment.amount,
      data.students.map((_, index) => ({
        enrollmentId: String(index),
        totalAmount,
        discount: data.discount,
        remainingBalance: totalAmount,
      }))
    )

    if (distribution.result === 'OK') {
      allocation = distribution.distribution.map((item) => ({
        studentIndex: Number(item.enrollmentId),
        amount: item.amount,
      }))
    } else {
      blockers.push({
        field: 'payment.amount',
        value: String(data.payment.amount),
        reason: distribution.result,
      })
    }
  }

  const familyMatches = await familyGateway.searchByName(schoolId, data.familyName)
  const personMatches = await Promise.all(
    data.students.map((student) =>
      personGateway.searchByName(schoolId, student.name, student.lastname)
    )
  )

  for (const match of familyMatches) {
    warnings.push({ field: 'familyName', value: match.name, reason: 'existingFamily' })
  }

  for (const [index, matches] of personMatches.entries()) {
    for (const match of matches) {
      warnings.push({
        field: `students.${index}`,
        value: `${match.name} ${match.lastname}`,
        reason: match.student ? 'existingStudent' : 'existingPerson',
      })
    }
  }

  if (data.payment?.reference) {
    const sameReference = await paymentGateway.findByReference(schoolId, data.payment.reference)
    if (sameReference.length > 0) {
      warnings.push({
        field: 'payment.reference',
        value: data.payment.reference,
        reason: 'referenceAlreadyUsed',
      })
    }
  }

  const matches = {
    families: familyMatches,
    students: personMatches.flat(),
  }

  if (blockers.length > 0 || !classPeriod || !plan) {
    return { draftId: null, checksum: null, plan: null, matches, warnings, blockers }
  }

  const resolved = {
    tool: ENROLL_FAMILY_TOOL,
    family: {
      name: data.familyName,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
      createdById: scope.userId,
    },
    parents: data.parents,
    students: data.students.map((student) => ({
      ...student,
      birthday: student.birthday.toISOString(),
    })),
    classPeriod: { id: classPeriod.id, name: classPeriod.name },
    plan: { id: plan.id, name: plan.name, amount: planAmount },
    discount: data.discount,
    totalAmount,
    payment: data.payment
      ? {
          amount: data.payment.amount,
          method: data.payment.method,
          reference: data.payment.reference,
          paidAt: data.payment.paidAt.toISOString(),
          cashedAt: data.payment.cashedAt?.toISOString(),
          allocation,
        }
      : null,
  }

  const checksum = draftChecksum(resolved)
  const draft = await mcpDraftGateway.create(schoolId, {
    keyId: scope.keyId,
    tool: ENROLL_FAMILY_TOOL,
    checksum,
    resolved,
    expiresAt: draftExpiry(),
  })

  return { draftId: draft.id, checksum, plan: resolved, matches, warnings, blockers }
}
