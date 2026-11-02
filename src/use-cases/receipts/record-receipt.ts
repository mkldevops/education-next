import { createHash } from 'node:crypto'
import type { z } from 'zod'
import { exceedsCharge } from '@/domain/childcare'
import { resolveDebtorFamily } from '@/domain/family-debtor'
import { previewMealPayment } from '@/domain/meal-ledger'
import { distributePayment } from '@/domain/payment'
import { canonicalReceiptRequest, receiptTotal } from '@/domain/receipt'
import { schoolToday } from '@/domain/school-date'
import { childcareGateway } from '@/gateways/childcare-gateway'
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

type Input = z.input<typeof recordReceiptSchema>
type Tx = Parameters<Parameters<typeof receiptGateway.transaction>[0]>[0]

type RecordReceiptError =
  | 'notFound'
  | 'notInFamily'
  | 'notSubscribed'
  | 'noPrice'
  | 'staleState'
  | 'overpayment'
  | 'childcareOverpayment'
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
 * et goûter, ses mois de garderie et une part d'écolage.
 *
 * Idempotent par `idempotencyKey` : un double clic ou une connexion qui lâche après
 * l'écriture renvoie le reçu déjà émis. La même clé avec un autre contenu est refusée.
 *
 * Tout se rejoue sous verrous — famille, comptes repas puis mois de garderie, dans l'ordre
 * des ids. Un mois annulé entre-temps vaut `staleState`, comme un mois déjà soldé. Le
 * « payé jusqu'au » vu par la caisse doit être celui relu sous verrou, sinon `staleState` :
 * un autre encaissement est passé entre l'aperçu et la validation. Le tarif appliqué est
 * celui du jour de l'encaissement, dans le fuseau de l'école.
 */
export async function recordReceipt(
  input: Input,
  receiptGw = receiptGateway,
  accountGw = mealAccountGateway,
  configGw = configGateway,
  childcareGw = childcareGateway
) {
  const parsed = recordReceiptSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const { schoolId, familyId, meals, childcare, tuition, idempotencyKey } = parsed.data
  const reference = parsed.data.reference || null

  if (!(await isMealsEnabled(schoolId, configGw))) return 'mealsDisabled' as const
  if (tuition > 0 && !(await isPaymentsEnabled(schoolId, configGw))) {
    return 'paymentsDisabled' as const
  }
  const { currency, timeZone } = await getSchoolRegionalSettings(schoolId)
  const amounts = [tuition, ...[...meals, ...childcare].map((line) => line.amount)]
  if (!amounts.every((n) => fitsCurrencyPrecision(n, currency))) {
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

  const checkChildcareLines = async (tx: Tx, lines: typeof childcare) => {
    const charges = await childcareGw.lockCharges(
      tx,
      schoolId,
      lines.map((line) => line.chargeId)
    )
    for (const line of lines) {
      const charge = charges.find((row) => row.id === line.chargeId)
      if (!charge || charge.cancelled) throw new Rollback('staleState')
      if (exceedsCharge(line.amount, charge.remaining)) throw new Rollback('childcareOverpayment')
    }
    const studentIds = [...new Set(charges.map((charge) => charge.studentId))]
    const students = await receiptGw.findChargedStudentFamilies(
      tx,
      schoolId,
      charges.map((charge) => charge.id)
    )
    const outside = studentIds.some((studentId) => {
      const student = students.find((row) => row.id === studentId)
      return !student || resolveDebtorFamily(student.person.families)?.familyId !== familyId
    })
    if (outside) throw new Rollback('notInFamily')
  }

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

      if (childcare.length > 0) {
        await checkChildcareLines(tx, childcare)
      }

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
        total: receiptTotal({ tuition, meals, childcare }),
        method: parsed.data.method,
        reference,
        paidAt,
        recordedById: parsed.data.recordedById,
        idempotencyKey,
        requestHash,
      })
      await receiptGw.createMealPayments(tx, schoolId, receipt.id, mealLines)
      if (childcare.length > 0) {
        await childcareGw.createPayments(tx, schoolId, receipt.id, childcare)
      }
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
