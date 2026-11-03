import { createHash } from 'node:crypto'
import type { z } from 'zod'
import { previewMealPayment } from '@/domain/meal-ledger'
import { schoolToday } from '@/domain/school-date'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { receiptGateway } from '@/gateways/receipt-gateway'
import { staffCanteenGateway } from '@/gateways/staff-canteen-gateway'
import { fitsCurrencyPrecision, roundHalfUp } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'
import { recordStaffReceiptSchema } from './schemas'

type Input = z.input<typeof recordStaffReceiptSchema>

type RecordStaffReceiptError = 'notFound' | 'exempt' | 'notSubscribed' | 'noPrice' | 'staleState'

class Rollback extends Error {
  constructor(readonly result: RecordStaffReceiptError) {
    super(result)
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

/**
 * Recharge repas d'un membre du personnel (#545) : un reçu numéroté sans famille, une seule
 * ligne, au tarif du jour du service, comme la recharge d'un élève. Un membre exempté n'est
 * jamais encaissé. Idempotent par `idempotencyKey`, rejoué sous le verrou du compte.
 */
export async function recordStaffReceipt(
  input: Input,
  receiptGw = receiptGateway,
  accountGw = mealAccountGateway,
  staffGw = staffCanteenGateway,
  configGw = configGateway
) {
  const parsed = recordStaffReceiptSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, teacherId, service, amount, expectedPaidThrough, idempotencyKey } = parsed.data
  const reference = parsed.data.reference || null

  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const
  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  if (!fitsCurrencyPrecision(amount, currency)) return 'validationError' as const

  const requestHash = createHash('sha256')
    .update(
      JSON.stringify({
        teacherId,
        service,
        amount: Math.round(amount * 100),
        expectedPaidThrough,
        method: parsed.data.method,
        reference,
      })
    )
    .digest('hex')
  const replay = async () => {
    const existing = await receiptGw.findByIdempotencyKey(schoolId, idempotencyKey)
    if (!existing) return null
    return existing.requestHash === requestHash
      ? { id: existing.id }
      : ('idempotencyConflict' as const)
  }

  const previous = await replay()
  if (previous) return previous

  const paidAt = new Date()
  const today = schoolToday(timeZone, paidAt)

  try {
    return await receiptGw.transaction(async (tx) => {
      const accountId = await accountGw.lockAccount(tx, schoolId, { teacherId }, service, false)
      const staff = await staffGw.findForReceipt(tx, schoolId, teacherId)
      if (!staff?.isActive) throw new Rollback('notFound')
      if (staff.mealExempt) throw new Rollback('exempt')
      if (!accountId) throw new Rollback('notSubscribed')

      const summaries = await loadMealAccountSummaries(
        tx,
        { schoolId, accounts: [{ id: accountId, service }], today },
        accountGw
      )
      const summary = summaries.get(accountId)
      if (!summary || summary.served.length === 0) throw new Rollback('notSubscribed')
      if (summary.unitPrice === null) throw new Rollback('noPrice')
      if (summary.coverage.paidThrough !== expectedPaidThrough) throw new Rollback('staleState')

      const preview = previewMealPayment({
        served: summary.served,
        ledger: summary.ledger,
        amount,
        unitPrice: summary.unitPrice,
        daysPerWeek: summary.current?.weekdays.length ?? 0,
      })

      const number = await receiptGw.nextNumber(tx, schoolId)
      const receipt = await receiptGw.create(tx, schoolId, {
        teacherId,
        number,
        total: roundHalfUp(amount),
        method: parsed.data.method,
        reference,
        paidAt,
        recordedById: parsed.data.recordedById,
        idempotencyKey,
        requestHash,
      })
      await receiptGw.createMealPayments(tx, schoolId, receipt.id, [
        {
          accountId,
          amount,
          unitPrice: summary.unitPrice,
          daysAdded: preview.daysAdded,
          paidThroughAtReceipt: preview.newPaidThrough,
          creditAtReceipt: preview.remainder,
        },
      ])
      return { id: receipt.id }
    })
  } catch (error) {
    if (error instanceof Rollback) return error.result
    if (isUniqueViolation(error)) {
      const raced = await replay()
      if (raced) return raced
    }
    throw error
  }
}
