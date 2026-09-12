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
 *  3. le décompte des références d'un compte avant sa suppression définitive — la
 *     question est plateforme, donc sans école, et doit voir les lignes archivées ;
 *  4. la purge des brouillons MCP expirés — un entretien de rétention, donc global ;
 *  5. le seed et la migration legacy — ils créent les écoles elles-mêmes.
 *
 * Aucun autre appelant ne doit importer ce module.
 */
import type { Invitation, PaymentTransaction, PrismaClient } from '@/generated/prisma/client'
import { createUnguardedArchivedClient, createUnguardedClient } from '@/lib/db'

const globalForUnscoped = globalThis as unknown as {
  prismaUnscoped: PrismaClient | undefined
  prismaUnscopedArchived: PrismaClient | undefined
}

function client(): PrismaClient {
  if (!globalForUnscoped.prismaUnscoped) {
    globalForUnscoped.prismaUnscoped = createUnguardedClient()
  }
  return globalForUnscoped.prismaUnscoped
}

function archivedClient(): PrismaClient {
  if (!globalForUnscoped.prismaUnscopedArchived) {
    globalForUnscoped.prismaUnscopedArchived = createUnguardedArchivedClient()
  }
  return globalForUnscoped.prismaUnscopedArchived
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
 * Exception 3 — un compte plateforme n'appartient à aucune école : demander s'il a
 * créé quoi que ce soit est une question globale, et un `schoolId` la rendrait fausse.
 *
 * Le décompte ignore délibérément le soft-delete : une famille archivée contraint
 * toujours la clé étrangère, donc la compter est la seule façon de prédire si la
 * suppression passera.
 */
export async function countRowsBlockingUserDeletion(userId: string): Promise<number> {
  const db = archivedClient()
  const [createdFamilies, createdInvitations, paymentTransactions] = await Promise.all([
    db.family.count({ where: { createdById: userId } }),
    db.invitation.count({ where: { createdById: userId } }),
    db.paymentTransaction.count({ where: { initiatedById: userId } }),
  ])
  return createdFamilies + createdInvitations + paymentTransactions
}

/**
 * Exception 4 — rétention, pas lecture de tenant. Un balayage par école demanderait
 * d'énumérer les écoles pour supprimer partout : le `schoolId` ne décrit rien ici, et
 * les lignes visées n'appartiennent plus à personne — elles sont hors d'usage.
 *
 * Appelée par `mcpDraftGateway.purgeExpired`, qui reste la seule frontière de `McpDraft`.
 */
export async function purgeExpiredMcpDrafts(now: Date, committedBefore: Date): Promise<number> {
  const { count } = await client().mcpDraft.deleteMany({
    where: {
      OR: [
        { status: 'PENDING', expiresAt: { lte: now } },
        { status: 'COMMITTED', expiresAt: { lte: committedBefore } },
      ],
    },
  })
  return count
}

/**
 * Exception 5 — seed et scripts de données uniquement. Ces programmes créent les
 * écoles et purgent des tables entières, deux opérations qu'aucun scope ne peut
 * décrire. Ne jamais importer depuis `app/**` ni `src/**`.
 */
export function unscopedDbForDataScripts(): PrismaClient {
  return client()
}
