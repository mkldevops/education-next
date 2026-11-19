import { dateToMonth } from '@/domain/childcare'
import type { MealService, PaymentMethod } from '@/generated/prisma/client'
import { db } from '@/lib/db'

export type StudentPaymentService = 'TUITION' | MealService | 'CHILDCARE'

export type StudentPaymentCoverage =
  | { kind: 'period'; name: string | null }
  | { kind: 'mealDays'; days: number; paidThrough: Date | null }
  | { kind: 'month'; month: string }

export type StudentPaymentEntry = {
  id: string
  service: StudentPaymentService
  paidAt: Date
  method: PaymentMethod
  amount: number
  coverage: StudentPaymentCoverage
}

export type StudentPaymentHistory = {
  entries: StudentPaymentEntry[]
  /** D'autres versements, plus anciens, existent au-delà de la limite. */
  hasMore: boolean
}

export const STUDENT_PAYMENT_HISTORY_LIMIT = 20

/**
 * Versements d'un élève, tous services confondus, du plus récent au plus ancien.
 *
 * Un reçu de caisse est familial, mais chacune de ses lignes vise un enfant : la ligne repas par
 * son compte, la ligne garderie par l'abonnement de son mois facturé. Seules les lignes de cet
 * élève sont lues, jamais le total du reçu. L'écolage vient des règlements de ses inscriptions ;
 * un règlement annulé, seul ou avec son reçu, est désactivé et disparaît du soft-delete.
 *
 * `includeServices` suit le module repas, qui porte aussi la garderie.
 */
export async function getStudentPaymentHistory(
  schoolId: string,
  studentId: string,
  { includeServices }: { includeServices: boolean },
  limit = STUDENT_PAYMENT_HISTORY_LIMIT
): Promise<StudentPaymentHistory> {
  // Une ligne de plus que la limite par source suffit à savoir s'il en reste.
  const take = limit + 1
  const receipt = { select: { paidAt: true, method: true } } as const

  const [tuition, meals, childcare] = await Promise.all([
    db.payment.findMany({
      where: { schoolId, isActive: true, enrollment: { schoolId, studentId } },
      select: {
        id: true,
        amount: true,
        method: true,
        paidAt: true,
        enrollment: {
          select: {
            classAssignments: {
              select: { classPeriod: { select: { period: { select: { name: true } } } } },
              orderBy: { startAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
      take,
    }),
    includeServices
      ? db.mealPayment.findMany({
          where: {
            schoolId,
            account: { schoolId, studentId },
            receipt: { cancelledAt: null },
          },
          select: {
            id: true,
            amount: true,
            daysAdded: true,
            paidThroughAtReceipt: true,
            account: { select: { service: true } },
            receipt,
          },
          orderBy: { receipt: { paidAt: 'desc' } },
          take,
        })
      : [],
    includeServices
      ? db.childcarePayment.findMany({
          where: {
            schoolId,
            charge: { subscription: { schoolId, studentId } },
            receipt: { cancelledAt: null },
          },
          select: { id: true, amount: true, charge: { select: { month: true } }, receipt },
          orderBy: { receipt: { paidAt: 'desc' } },
          take,
        })
      : [],
  ])

  const entries: StudentPaymentEntry[] = [
    ...tuition.map((payment) => ({
      id: `tuition:${payment.id}`,
      service: 'TUITION' as const,
      paidAt: payment.paidAt,
      method: payment.method,
      amount: Number(payment.amount),
      coverage: {
        kind: 'period' as const,
        name: payment.enrollment.classAssignments[0]?.classPeriod.period.name ?? null,
      },
    })),
    ...meals.map((line) => ({
      id: `meal:${line.id}`,
      service: line.account.service,
      paidAt: line.receipt.paidAt,
      method: line.receipt.method,
      amount: Number(line.amount),
      coverage: {
        kind: 'mealDays' as const,
        days: line.daysAdded,
        paidThrough: line.paidThroughAtReceipt,
      },
    })),
    ...childcare.map((line) => ({
      id: `childcare:${line.id}`,
      service: 'CHILDCARE' as const,
      paidAt: line.receipt.paidAt,
      method: line.receipt.method,
      amount: Number(line.amount),
      coverage: { kind: 'month' as const, month: dateToMonth(line.charge.month) },
    })),
  ].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())

  return { entries: entries.slice(0, limit), hasMore: entries.length > limit }
}
