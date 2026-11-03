import { summarizeCashDay } from '@/domain/cash-day'
import { schoolDayBounds } from '@/domain/school-date'
import { teacherName } from '@/domain/teacher'
import { db } from '@/lib/db'

const receiptSelect = {
  id: true,
  number: true,
  total: true,
  method: true,
  createdAt: true,
  cancelledAt: true,
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
