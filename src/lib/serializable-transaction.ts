import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

/** `40001` remonté par Prisma : la transaction a été abandonnée, pas refusée. */
const SERIALIZATION_FAILURE = 'P2034'

function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === SERIALIZATION_FAILURE
  )
}

/**
 * Transaction `Serializable`, rejouée une fois si PostgreSQL l'abandonne.
 *
 * Un compte-puis-mute sous SSI fait abandonner l'une de deux transactions concurrentes :
 * c'est ce qui tient la règle. Mais Prisma ne rejoue pas une transaction interactive, et
 * `P2034` ne dit pas « refusé », il dit « rejoue » — sans reprise, deux opérations
 * pourtant légitimes qui se croisent font remonter une exception à la place du verdict.
 * Au second passage, la lecture voit la ligne gagnante et la règle tranche elle-même.
 *
 * Une seule reprise, volontairement : deux abandons de suite ne sont plus une course
 * mais une contention, que rejouer n'absorbe pas.
 */
export async function inSerializableTransaction<T>(
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    return await db.$transaction(run, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (!isSerializationFailure(error)) throw error

    return db.$transaction(run, { isolationLevel: 'Serializable' })
  }
}
