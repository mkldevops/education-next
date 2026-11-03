import type { z } from 'zod'
import type { McpFinding } from '@/domain/mcp-draft'
import { allocatePayment, enrollmentBalances } from '@/domain/payment'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { fitsCurrencyPrecision, roundHalfUp } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { blockedPreview, saveDraftPreview } from './draft-response'
import type { DraftScope } from './draft-scope'
import { previewRecordPaymentSchema } from './schemas'

// `z.input`, pas `z.infer` : l'entrée vient d'un modèle et traverse le schéma — un défaut
// y est absent.
type Input = z.input<typeof previewRecordPaymentSchema>

export const RECORD_PAYMENT_TOOL = 'record_payment'

const DEFAULT_PAYMENT_METHOD = 'CASH'

type ParsedInput = z.infer<typeof previewRecordPaymentSchema>

function familyLookup(data: ParsedInput) {
  if (data.familyId) return { field: 'familyId', value: data.familyId } as const
  if (data.studentId) return { field: 'studentId', value: data.studentId } as const
  return { field: 'familyName', value: data.familyName ?? '' } as const
}

/**
 * Inscription visée par l'encaissement, `undefined` pour la répartition sur la famille.
 * `target: 'student'` cherche l'unique inscription payable de l'élève dans cette famille ;
 * sans elle, ou devant plusieurs, l'agent doit passer `enrollmentId`.
 */
function targetEnrollment(
  data: ParsedInput,
  enrollments: ReadonlyArray<{ id: string; studentId: string }>
): { enrollmentId?: string; blocker?: McpFinding } {
  if (data.enrollmentId) return { enrollmentId: data.enrollmentId }
  if (data.target !== 'student' || !data.studentId) return {}

  const studentId = data.studentId
  const own = enrollments.filter((enrollment) => enrollment.studentId === studentId)
  if (own.length === 1) return { enrollmentId: own[0].id }
  return {
    blocker: {
      field: 'studentId',
      value: studentId,
      reason: own.length === 0 ? 'enrollmentNotPayable' : 'ambiguousEnrollment',
    },
  }
}

export async function previewRecordPayment(
  scope: DraftScope,
  input: Input,
  now: () => Date = () => new Date()
) {
  const parsed = previewRecordPaymentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  // Défense en profondeur : l'outil n'est déjà pas déclaré quand le drapeau est coupé,
  // mais un appel direct par nom ne doit ni lire une famille ni proposer de brouillon.
  if (!scope.paymentsEnabled) return 'paymentsDisabled' as const
  const { schoolId } = scope
  const data = parsed.data

  const blockers: McpFinding[] = []
  const warnings: McpFinding[] = []

  const lookup = familyLookup(data)
  const candidates =
    lookup.field === 'familyId'
      ? [await familyGateway.findById(schoolId, lookup.value)].filter((row) => row !== null)
      : lookup.field === 'studentId'
        ? await familyGateway.findByStudent(schoolId, lookup.value)
        : await familyGateway.searchByName(schoolId, lookup.value)

  const matches = { families: candidates.map((row) => ({ id: row.id, name: row.name })) }

  if (candidates.length !== 1) {
    blockers.push({
      field: lookup.field,
      value: lookup.value,
      reason: candidates.length === 0 ? 'notFound' : 'ambiguousFamily',
    })
    return blockedPreview(matches, warnings, blockers)
  }

  const family = candidates[0]
  const enrollments = await enrollmentGateway.findPayableByFamily(schoolId, family.id)
  const { currency } = await getSchoolRegionalSettings(schoolId)
  const balances = enrollmentBalances(enrollments)

  const target = targetEnrollment(data, enrollments)
  if (target.blocker) {
    blockers.push(target.blocker)
    return blockedPreview(matches, warnings, blockers)
  }
  const enrollmentId = target.enrollmentId

  // Sans montant, la famille — ou l'enfant visé — solde ce qu'il doit : c'est le cas courant
  // au guichet.
  const amount =
    data.amount ??
    roundHalfUp(
      balances
        .filter((row) => enrollmentId === undefined || row.enrollmentId === enrollmentId)
        .reduce((sum, row) => sum + row.remainingBalance, 0)
    )

  let allocation: Array<{ enrollmentId: string; amount: number }> = []
  if (amount === 0) {
    blockers.push({ field: 'amount', value: '0', reason: 'nothingDue' })
  } else if (!fitsCurrencyPrecision(amount, currency)) {
    blockers.push({ field: 'amount', value: String(amount), reason: 'invalidPrecision' })
  } else {
    const distribution = allocatePayment(amount, balances, enrollmentId)
    if (distribution.result === 'OK') {
      allocation = distribution.distribution
    } else if (distribution.result === 'enrollmentNotPayable') {
      blockers.push({
        field: 'enrollmentId',
        value: enrollmentId ?? '',
        reason: distribution.result,
      })
    } else {
      blockers.push({ field: 'amount', value: String(amount), reason: distribution.result })
    }
  }

  if (data.reference) {
    const sameReference = await paymentGateway.findByReference(schoolId, data.reference)
    if (sameReference.length > 0) {
      warnings.push({
        field: 'reference',
        value: data.reference,
        reason: 'referenceAlreadyUsed',
      })
    }
  }

  if (blockers.length > 0) {
    return blockedPreview(matches, warnings, blockers)
  }

  const resolved = {
    tool: RECORD_PAYMENT_TOOL,
    family: { id: family.id, name: family.name },
    method: data.method ?? DEFAULT_PAYMENT_METHOD,
    reference: data.reference,
    paidAt: (data.paidAt ? new Date(data.paidAt) : now()).toISOString(),
    cashedAt: data.cashedAt ? new Date(data.cashedAt).toISOString() : undefined,
    amount,
    currency,
    // Absente, le montant est réparti sur la famille ; présente, il va tout entier à cette
    // inscription, et le commit rejoue la même cible.
    enrollmentId,
    // La répartition résolue est ce que l'action serveur actuelle ne montre jamais :
    // l'humain valide un encaissement ventilé, pas un montant global. Le commit la
    // recalcule sur les soldes frais et refuse si elle a bougé.
    allocation,
  }

  return saveDraftPreview(scope, RECORD_PAYMENT_TOOL, resolved, matches, warnings, blockers)
}
