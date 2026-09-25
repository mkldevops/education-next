import type { Prisma } from '@/generated/prisma/client'

/** Verrou transactionnel Postgres, libéré au commit ou au rollback. */
export function acquireAdvisoryLock(tx: Prisma.TransactionClient, key: string) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
}

/** Comme `acquireAdvisoryLock`, sans attendre : `false` quand une autre transaction le tient. */
export async function tryAcquireAdvisoryLock(tx: Prisma.TransactionClient, key: string) {
  const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS "locked"`
  return rows[0]?.locked === true
}
