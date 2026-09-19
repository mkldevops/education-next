import type { Prisma } from '@/generated/prisma/client'

/** Verrou transactionnel Postgres, libéré au commit ou au rollback. */
export function acquireAdvisoryLock(tx: Prisma.TransactionClient, key: string) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
}
