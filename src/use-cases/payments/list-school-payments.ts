import {
  type FamilyPayment,
  filterFamilyPaymentsByPeriod,
  groupFamilyPayments,
} from '@/domain/payment'
import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

/**
 * Les seuls champs que la liste affiche, plus les clés que `groupFamilyPayments` compare pour
 * replier les lignes d'un même versement (`enrollmentId`, `paymentTransactionId`, `createdAt`).
 */
const paymentLineSelect = {
  id: true,
  familyId: true,
  enrollmentId: true,
  paymentTransactionId: true,
  amount: true,
  method: true,
  reference: true,
  paidAt: true,
  cashedAt: true,
  createdAt: true,
  family: { select: { name: true } },
  enrollment: {
    select: { student: { select: { person: { select: { name: true, lastname: true } } } } },
  },
} satisfies Prisma.PaymentSelect

type SchoolPaymentLine = Prisma.PaymentGetPayload<{ select: typeof paymentLineSelect }>

type SchoolPayment = FamilyPayment<SchoolPaymentLine> & { periodAmount: number }

/**
 * Les versements d'une école, un par somme remise par une famille, du plus récent au plus ancien.
 *
 * Sans période, tout l'historique est demandé et lu tel quel. Avec une période, seules les lignes
 * dont l'inscription y est affectée sont cherchées en base ; comme un versement ne doit jamais
 * être coupé (`filterFamilyPaymentsByPeriod`), leurs lignes sœurs — même famille, même date de
 * paiement, donc même clé de regroupement — sont relues ensuite, et le regroupement se fait sur
 * cet ensemble borné plutôt que sur tout l'historique de l'école.
 */
export async function listSchoolPayments(
  schoolId: string,
  periodId: string | null
): Promise<SchoolPayment[]> {
  if (!periodId) {
    const lines = await db.payment.findMany({
      where: { schoolId },
      select: paymentLineSelect,
      orderBy: { paidAt: 'desc' },
    })
    return groupFamilyPayments(lines).map((payment) => ({
      ...payment,
      periodAmount: payment.amount,
    }))
  }

  const inPeriod = await db.payment.findMany({
    where: { schoolId, enrollment: { classAssignments: { some: { classPeriod: { periodId } } } } },
    select: { id: true, familyId: true, paidAt: true },
  })
  if (inPeriod.length === 0) return []

  const inPeriodIds = new Set(inPeriod.map((line) => line.id))
  const familyIds = [...new Set(inPeriod.map((line) => line.familyId))]
  const paidAts = [
    ...new Map(inPeriod.map((line) => [line.paidAt.getTime(), line.paidAt])).values(),
  ]

  const lines = await db.payment.findMany({
    where: { schoolId, familyId: { in: familyIds }, paidAt: { in: paidAts } },
    select: paymentLineSelect,
    orderBy: { paidAt: 'desc' },
  })

  return filterFamilyPaymentsByPeriod(groupFamilyPayments(lines), (line) =>
    inPeriodIds.has(line.id)
  )
}
