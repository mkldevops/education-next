import type { z } from 'zod'
import { draftExpiry, type McpFinding } from '@/domain/mcp-draft'
import { distributePayment, enrollmentBalances } from '@/domain/payment'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { familyGateway } from '@/gateways/family-gateway'
import { mcpDraftGateway } from '@/gateways/mcp-draft-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { draftChecksum } from '@/lib/mcp-draft-crypto'
import type { McpScope } from './resolve-mcp-scope'
import { previewRecordPaymentSchema } from './schemas'

// `z.input`, pas `z.infer` : l'entrée vient d'un modèle et traverse le schéma — un défaut
// y est absent.
type Input = z.input<typeof previewRecordPaymentSchema>

export const RECORD_PAYMENT_TOOL = 'record_payment'

export async function previewRecordPayment(scope: McpScope, input: Input) {
  const parsed = previewRecordPaymentSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId } = scope
  const data = parsed.data

  const blockers: McpFinding[] = []
  const warnings: McpFinding[] = []

  const candidates = data.familyId
    ? [await familyGateway.findById(schoolId, data.familyId)].filter((row) => row !== null)
    : await familyGateway.searchByName(schoolId, data.familyName ?? '')

  const matches = { families: candidates.map((row) => ({ id: row.id, name: row.name })) }

  if (candidates.length !== 1) {
    blockers.push({
      field: data.familyId ? 'familyId' : 'familyName',
      value: data.familyId ?? data.familyName ?? '',
      reason: candidates.length === 0 ? 'notFound' : 'ambiguousFamily',
    })
    return { draftId: null, checksum: null, plan: null, matches, warnings, blockers }
  }

  const family = candidates[0]
  const enrollments = await enrollmentGateway.findPayableByFamily(schoolId, family.id)

  let allocation: Array<{ enrollmentId: string; amount: number }> = []
  const distribution = distributePayment(data.amount, enrollmentBalances(enrollments))
  if (distribution.result === 'OK') {
    allocation = distribution.distribution
  } else {
    blockers.push({
      field: 'amount',
      value: String(data.amount),
      reason: distribution.result,
    })
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
    return { draftId: null, checksum: null, plan: null, matches, warnings, blockers }
  }

  const resolved = {
    tool: RECORD_PAYMENT_TOOL,
    family: { id: family.id, name: family.name },
    method: data.method,
    reference: data.reference,
    paidAt: new Date(data.paidAt).toISOString(),
    cashedAt: data.cashedAt ? new Date(data.cashedAt).toISOString() : undefined,
    amount: data.amount,
    // La répartition résolue est ce que l'action serveur actuelle ne montre jamais :
    // l'humain valide un encaissement ventilé, pas un montant global. Le commit la
    // recalcule sur les soldes frais et refuse si elle a bougé.
    allocation,
  }

  const checksum = draftChecksum(resolved)
  const draft = await mcpDraftGateway.create(schoolId, {
    keyId: scope.keyId,
    tool: RECORD_PAYMENT_TOOL,
    checksum,
    resolved,
    expiresAt: draftExpiry(),
  })

  return { draftId: draft.id, checksum, plan: resolved, matches, warnings, blockers }
}
