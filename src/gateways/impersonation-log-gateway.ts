import { db } from '@/lib/db'

export type ImpersonationStart = {
  actorId: string
  actorEmail: string
  targetId: string
  targetEmail: string
  sessionId: string
  ipAddress: string | null
  userAgent: string | null
  expiresAt: Date
}

/** Trace durable des emprunts d'identité (`ImpersonationLog`), hors de toute école. */
export const impersonationLogGateway = {
  recordStart: async (entry: ImpersonationStart): Promise<void> => {
    await db.impersonationLog.create({ data: entry })
  },

  /** Clôt la trace ouverte pour cette session ; sans effet si elle l'est déjà. */
  recordEnd: async (sessionId: string, endedAt: Date = new Date()): Promise<void> => {
    await db.impersonationLog.updateMany({
      where: { sessionId, endedAt: null },
      data: { endedAt },
    })
  },
}
