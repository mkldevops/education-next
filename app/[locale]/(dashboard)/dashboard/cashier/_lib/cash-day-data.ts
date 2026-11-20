import { summarizeCashDay } from '@/domain/cash-day'
import { groupFamilyPayments } from '@/domain/payment'
import { schoolDayBounds } from '@/domain/school-date'
import { teacherName } from '@/domain/teacher'
import { db } from '@/lib/db'
import { roundHalfUp } from '@/lib/decimal'

const receiptSelect = {
  id: true,
  number: true,
  total: true,
  method: true,
  createdAt: true,
  cancelledAt: true,
  familyId: true,
  family: { select: { name: true } },
  teacher: { select: { firstName: true, lastName: true } },
  mealPayments: { select: { amount: true, account: { select: { service: true } } } },
  childcarePayments: { select: { amount: true } },
} as const

/** Reçus émis et reçus annulés pendant le jour local `day` de l'école, et leur caisse. */
export async function loadCashDay(schoolId: string, day: string, timeZone: string) {
  const { start, end } = schoolDayBounds(day, timeZone)
  const [issued, cancelled] = await Promise.all([
    db.receipt.findMany({
      where: { schoolId, createdAt: { gte: start, lt: end } },
      select: receiptSelect,
      orderBy: { number: 'asc' },
    }),
    db.receipt.findMany({
      where: { schoolId, cancelledAt: { gte: start, lt: end } },
      select: receiptSelect,
      orderBy: { number: 'asc' },
    }),
  ])
  const toCash = (receipt: (typeof issued)[number]) => ({
    total: Number(receipt.total),
    method: receipt.method,
    meals: receipt.mealPayments.map((payment) => ({
      service: payment.account.service,
      amount: Number(payment.amount),
    })),
    childcare: receipt.childcarePayments.map((payment) => ({ amount: Number(payment.amount) })),
  })
  const toRow = (receipt: (typeof issued)[number]) => ({
    id: receipt.id,
    number: receipt.number,
    familyId: receipt.familyId,
    createdAt: receipt.createdAt,
    family: receipt.family?.name ?? (receipt.teacher ? teacherName(receipt.teacher) : ''),
    total: Number(receipt.total),
    method: receipt.method,
    cancelled: receipt.cancelledAt !== null,
  })

  return {
    ...summarizeCashDay({ issued: issued.map(toCash), cancelled: cancelled.map(toCash) }),
    issuedRows: issued.map(toRow),
    cancelledRows: cancelled.map(toRow),
  }
}

/**
 * Paiements d'écolage enregistrés pendant le jour local `day` sans reçu, remboursements compris,
 * une ligne par somme versée. Ils restent hors de la caisse, que seuls les reçus font : un
 * paiement qui reçoit son reçu plus tard quitte cette liste et compte le jour du reçu. Les
 * paiements annulés sont inactifs, donc absents.
 */
export async function loadUnreceiptedPayments(schoolId: string, day: string, timeZone: string) {
  const { start, end } = schoolDayBounds(day, timeZone)
  const payments = await db.payment.findMany({
    where: { schoolId, receiptId: null, createdAt: { gte: start, lt: end } },
    select: {
      id: true,
      familyId: true,
      enrollmentId: true,
      amount: true,
      method: true,
      reference: true,
      paidAt: true,
      cashedAt: true,
      paymentTransactionId: true,
      createdAt: true,
      family: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  const rows = groupFamilyPayments(payments)
    .sort((a, b) => a.lines[0].createdAt.getTime() - b.lines[0].createdAt.getTime())
    .map((payment) => ({
      id: payment.id,
      familyId: payment.familyId,
      family: payment.lines[0].family.name,
      amount: payment.amount,
      method: payment.method,
    }))

  return { rows, total: roundHalfUp(rows.reduce((sum, row) => sum + row.amount, 0)) }
}
