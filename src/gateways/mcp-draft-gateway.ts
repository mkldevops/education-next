import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'

const draftSelect = {
  id: true,
  tool: true,
  checksum: true,
  resolved: true,
  status: true,
  result: true,
  expiresAt: true,
} as const

/**
 * Seule frontière d'accès à `McpDraft`, et propriétaire du verrou à passage unique.
 *
 * Le brouillon porte un plan déjà résolu : le `commit_*` ne recalcule rien, il engage.
 * Toute la sûreté du rejeu tient donc dans `claim`, pas dans l'appelant.
 */
export const mcpDraftGateway = {
  create: (
    schoolId: string,
    data: {
      keyId: string
      tool: string
      checksum: string
      resolved: Prisma.InputJsonValue
      expiresAt: Date
    }
  ) => db.mcpDraft.create({ data: { ...data, schoolId }, select: { id: true } }),

  findById: (schoolId: string, id: string) =>
    db.mcpDraft.findUnique({
      where: { id_schoolId: { id, schoolId } },
      select: draftSelect,
    }),

  /**
   * Prise du verrou par `updateMany` conditionnel, jamais par `findFirst` puis `update`.
   *
   * Deux `commit_*` concurrents — le cas normal après une coupure réseau et un rejeu du
   * client — doivent en voir exactement un passer. `count === 1` gagne ; `count === 0`
   * renvoie l'appelant au brouillon pour distinguer rejeu, expiration et checksum faux.
   */
  claim: (schoolId: string, id: string, tool: string, checksum: string, now: Date) =>
    db.mcpDraft.updateMany({
      where: { id, schoolId, tool, checksum, status: 'PENDING', expiresAt: { gt: now } },
      data: { status: 'COMMITTED', committedAt: now },
    }),

  recordResult: (schoolId: string, id: string, result: Prisma.InputJsonValue) =>
    db.mcpDraft.updateMany({ where: { id, schoolId }, data: { result } }),
}
