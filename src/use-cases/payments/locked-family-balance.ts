import { type EnrollmentBalance, enrollmentBalances } from '@/domain/payment'
import { enrollmentGateway } from '@/gateways/enrollment-gateway'
import { paymentGateway } from '@/gateways/payment-gateway'
import type { Prisma } from '@/generated/prisma/client'

/**
 * Soldes d'une famille, relus sous son verrou d'encaissement.
 *
 * À appeler en tête de la transaction qui écrit les `Payment` : le verrou tient jusqu'au
 * commit, donc un second encaissement de la même famille attend puis relit le solde que
 * le premier a laissé, au lieu de répartir le même montant une seconde fois. Tout
 * encaissement — saisie, brouillon MCP, webhook Stripe — doit passer par
 * `paymentGateway.lockFamilyForPayment` avant de lire le solde qu'il répartit.
 *
 * `notFound` quand la famille n'existe pas dans cette école ou est archivée.
 */
export async function readLockedFamilyBalances(
  tx: Prisma.TransactionClient,
  schoolId: string,
  familyId: string
): Promise<'notFound' | EnrollmentBalance[]> {
  if (!(await paymentGateway.lockFamilyForPayment(tx, schoolId, familyId))) {
    return 'notFound'
  }

  const enrollments = await enrollmentGateway.findPayableByFamily(schoolId, familyId, tx)
  return enrollmentBalances(enrollments)
}
