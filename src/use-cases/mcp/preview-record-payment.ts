import type { z } from 'zod'
import type { McpFinding } from '@/domain/mcp-draft'
import { distributePayment, enrollmentBalances } from '@/domain/payment'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { roundHalfUp } from '@/lib/decimal'
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
  const balances = enrollmentBalances(enrollments)

  // Sans montant, la famille solde ce qu'elle doit : c'est le cas courant au guichet.
  const amount =
    data.amount ?? roundHalfUp(balances.reduce((sum, row) => sum + row.remainingBalance, 0))

  let allocation: Array<{ enrollmentId: string; amount: number }> = []
  if (amount === 0) {
    blockers.push({ field: 'amount', value: '0', reason: 'nothingDue' })
  } else {
    const distribution = distributePayment(amount, balances)
    if (distribution.result === 'OK') {
      allocation = distribution.distribution
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
    // La répartition résolue est ce que l'action serveur actuelle ne montre jamais :
    // l'humain valide un encaissement ventilé, pas un montant global. Le commit la
    // recalcule sur les soldes frais et refuse si elle a bougé.
    allocation,
  }

  return saveDraftPreview(scope, RECORD_PAYMENT_TOOL, resolved, matches, warnings, blockers)
}
