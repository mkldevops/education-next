import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import type { Prisma } from '@/generated/prisma/client'
import { roundHalfUp } from '@/lib/decimal'

/**
 * Ce qu'une inscription a déjà encaissé, relu sous le verrou de sa famille redevable.
 *
 * À appeler en tête de la transaction qui abaisse un total (`applyDiscount`,
 * `setEnrollmentPlan`) : `recordPayment` tient le même verrou
 * (`paymentGateway.lockFamilyForPayment`) pendant qu'il répartit un règlement, donc un
 * total ramené à 50 € et un encaissement de 100 € lancés ensemble se sérialisent — le
 * second relit ce que le premier a écrit et répond `totalBelowPaid` ou `overpayment`, au
 * lieu de laisser 100 € payés pour 50 € dus (#425). Un total lu hors verrou ne protège de
 * rien : le contrôle et l'écriture doivent rester dans la transaction qui a appelé ici.
 *
 * Un élève sans famille redevable n'a rien à verrouiller : aucun encaissement ne peut
 * viser son inscription (`findPayableByFamily`), ses paiements sont simplement relus dans
 * la transaction. `notFound` quand l'inscription n'est pas — ou plus — ouverte dans cette
 * école, ou quand sa famille est archivée : `recordPayment` la refuse pareil.
 */
export async function readLockedPaidAmount(
  tx: Prisma.TransactionClient,
  schoolId: string,
  enrollmentId: string
): Promise<'notFound' | number> {
  const debtor = await enrollmentGateway.findDebtorFamily(tx, schoolId, enrollmentId)
  if (!debtor) return 'notFound'

  if (
    debtor.familyId !== null &&
    !(await paymentGateway.lockFamilyForPayment(tx, schoolId, debtor.familyId))
  ) {
    return 'notFound'
  }

  const locked = await enrollmentGateway.findOpenActivePayments(tx, schoolId, enrollmentId)
  if (!locked) return 'notFound'

  return roundHalfUp(locked.payments.reduce((sum, payment) => sum + Number(payment.amount), 0))
}
