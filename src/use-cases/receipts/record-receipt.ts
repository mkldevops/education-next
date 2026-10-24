import { createHash } from 'node:crypto'
import type { z } from 'zod'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { previewMealPayment } from '@/domain/meal-ledger'
import { distributePayment } from '@/domain/payment'
import { canonicalReceiptRequest, receiptTotal } from '@/domain/receipt'
import { schoolToday } from '@/domain/school-date'
import { configGateway } from '@/gateways/config-gateway'
import { mealAccountGateway } from '@/gateways/meal-account-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import { receiptGateway } from '@/gateways/receipt-gateway'
import { fitsCurrencyPrecision } from '@/lib/decimal'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { loadMealAccountSummaries } from '@/use-cases/meals/meal-account-summaries'
import { readLockedFamilyBalances } from '@/use-cases/payments/locked-family-balance'
import { recordReceiptSchema } from './schemas'

type Input = z.infer<typeof recordReceiptSchema>

type RecordReceiptError =
  | 'notFound'
  | 'notInFamily'
  | 'notSubscribed'
  | 'noPrice'
  | 'staleState'
  | 'overpayment'
  | 'noPayableEnrollments'
  | 'refundExceedsPaid'

/** Sort de la transaction sans rien écrire, en portant le refus métier. */
class Rollback extends Error {
  constructor(readonly result: RecordReceiptError) {
    super(result)
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

/**
 * Encaissement en caisse : un reçu numéroté pour une famille, avec ses recharges cantine
 * et goûter et une part d'écolage.
 *
 * Idempotent par `idempotencyKey` : un double clic ou une connexion qui lâche après
 * l'écriture renvoie le reçu déjà émis. La même clé avec un autre contenu est refusée.
 *
 * Tout se rejoue sous verrous — famille, puis comptes repas dans l'ordre des ids. Le
 * « payé jusqu'au » vu par la caisse doit être celui relu sous verrou, sinon `staleState` :
 * un autre encaissement est passé entre l'aperçu et la validation. Le tarif appliqué est
 * celui du jour de l'encaissement, dans le fuseau de l'école.
 */
export async function recordReceipt(
  input: Input,
  receiptGw = receiptGateway,
  accountGw = mealAccountGateway,
  configGw = configGateway
) {
  const parsed = recordReceiptSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, familyId, meals, tuition, idempotencyKey } = parsed.data
  const reference = parsed.data.reference || null

  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const
  if (tuition > 0 && !(await isPaymentsEnabled(schoolId, configGw))) {
    return 'paymentsDisabled' as const
  }
  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  if (
    ![tuition, ...meals.map((line) => line.amount)].every((n) => fitsCurrencyPrecision(n, currency))
  ) {
    return 'validationError' as const
  }

  const requestHash = createHash('sha256')
    .update(canonicalReceiptRequest({ ...parsed.data, reference }))
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
      if (!(await paymentGateway.lockFamilyForPayment(tx, schoolId, familyId))) {
        throw new Rollback('notFound')
      }

      const studentIds = [...new Set(meals.map((line) => line.studentId))]
      const students = await receiptGw.findStudentFamilies(tx, schoolId, studentIds)
      const outside = studentIds.some((studentId) => {
        const student = students.find((row) => row.id === studentId)
        return !student || resolveDebtorFamily(student.person.families)?.familyId !== familyId
      })
      if (outside) throw new Rollback('notInFamily')

      const accounts = await accountGw.lockAccounts(tx, schoolId, meals)
      const summaries = await loadMealAccountSummaries(tx, { schoolId, accounts, today }, accountGw)
      const mealLines = meals.map((line) => {
        const account = accounts.find(
          (row) => row.studentId === line.studentId && row.service === line.service
        )
        const summary = account ? summaries.get(account.id) : undefined
        if (!account || !summary || summary.served.length === 0) {
          throw new Rollback('notSubscribed')
        }
        if (summary.unitPrice === null) throw new Rollback('noPrice')
        if (summary.coverage.paidThrough !== line.expectedPaidThrough) {
          throw new Rollback('staleState')
        }
        const preview = previewMealPayment({
          served: summary.served,
          ledger: summary.ledger,
          amount: line.amount,
          unitPrice: summary.unitPrice,
          daysPerWeek: summary.current?.weekdays.length ?? 0,
        })
        return {
          accountId: account.id,
          amount: line.amount,
          unitPrice: summary.unitPrice,
          daysAdded: preview.daysAdded,
          paidThroughAtReceipt: preview.newPaidThrough,
          creditAtReceipt: preview.remainder,
        }
      })

      let tuitionRows: Array<{ enrollmentId: string; amount: number }> = []
      if (tuition > 0) {
        const balances = await readLockedFamilyBalances(tx, schoolId, familyId)
        if (balances === 'notFound') throw new Rollback('notFound')
        const distribution = distributePayment(tuition, balances)
        if (distribution.result !== 'OK') throw new Rollback(distribution.result)
        tuitionRows = distribution.distribution
      }

      const number = await receiptGw.nextNumber(tx, schoolId)
      const receipt = await receiptGw.create(tx, schoolId, {
        familyId,
        number,
        total: receiptTotal({ tuition, meals }),
        method: parsed.data.method,
        reference,
        paidAt,
        recordedById: parsed.data.recordedById,
        idempotencyKey,
        requestHash,
      })
      await receiptGw.createMealPayments(tx, schoolId, receipt.id, mealLines)
      await paymentGateway.createForFamily(
        tx,
        schoolId,
        tuitionRows.map((row) => ({
          familyId,
          enrollmentId: row.enrollmentId,
          amount: row.amount,
          method: parsed.data.method,
          reference: reference ?? undefined,
          paidAt,
          receiptId: receipt.id,
        }))
      )
      return { id: receipt.id }
    })
  } catch (error) {
    if (error instanceof Rollback) return error.result
    // Une caisse concurrente a écrit la même clé entre la relecture et l'insertion.
    if (isUniqueViolation(error)) {
      const raced = await replay()
      if (raced) return raced
    }
    throw error
  }
}
