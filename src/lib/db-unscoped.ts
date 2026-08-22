/**
 * Les seules portes de sortie du garde tenant, nommées et auditées.
 *
 * Chacune correspond à un chemin qui s'exécute AVANT qu'une école active puisse
 * exister, et dont l'autorisation est portée par autre chose qu'un `schoolId` :
 *
 *  1. l'invitation lue par `token` — flux public, le token unique et non devinable
 *     porte l'autorisation, et l'école est LUE depuis l'invitation ;
 *  2. le webhook Stripe — authentifié par signature, retrouve sa transaction par
 *     `providerSessionId` unique ;
 *  3. le seed et la migration legacy — ils créent les écoles elles-mêmes.
 *
 * Aucun autre appelant ne doit importer ce module.
 */
import type { Invitation, PaymentTransaction, PrismaClient } from '@/generated/prisma/client'
import { createUnguardedClient } from '@/lib/db'

const globalForUnscoped = globalThis as unknown as {
  prismaUnscoped: PrismaClient | undefined
}

function client(): PrismaClient {
  if (!globalForUnscoped.prismaUnscoped) {
    globalForUnscoped.prismaUnscoped = createUnguardedClient()
  }
  return globalForUnscoped.prismaUnscoped
}

/**
 * Exception 1 — flux d'invitation public. L'appelant ne fournit jamais d'école :
 * il la lit sur l'invitation retournée.
 */
export async function findInvitationByToken(token: string): Promise<Invitation | null> {
  return client().invitation.findUnique({ where: { token } })
}

/** Exception 2 — webhook Stripe, sans session ni cookie. */
export async function findPaymentTransactionByProviderSessionId(
  providerSessionId: string
): Promise<PaymentTransaction | null> {
  return client().paymentTransaction.findUnique({ where: { providerSessionId } })
}

/**
 * Exception 3 — seed et scripts de données uniquement. Ces programmes créent les
 * écoles et purgent des tables entières, deux opérations qu'aucun scope ne peut
 * décrire. Ne jamais importer depuis `app/**` ni `src/**`.
 */
export function unscopedDbForDataScripts(): PrismaClient {
  return client()
}
