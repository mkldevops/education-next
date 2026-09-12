import { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { purgeExpiredMcpDrafts } from '@/lib/db-unscoped'

const draftSelect = {
  id: true,
  keyId: true,
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
   *
   * `keyId` fait partie de la condition : un brouillon appartient à la clé qui l'a proposé.
   * Sans lui, une clé révoquée verrait son plan engagé par une autre clé de la même école,
   * au nom de son propre utilisateur — `createdById` est figé dans le plan résolu.
   */
  claim: (schoolId: string, keyId: string, id: string, tool: string, checksum: string, now: Date) =>
    db.mcpDraft.updateMany({
      where: { id, schoolId, keyId, tool, checksum, status: 'PENDING', expiresAt: { gt: now } },
      data: { status: 'COMMITTED', committedAt: now },
    }),

  /**
   * Reprise d'un verrou abandonné, aux mêmes conditions que `claim`.
   *
   * `result` nul dit que la transaction n'a rien écrit — elle écrit le résultat. Un
   * `commit_*` tué entre la prise du verrou et la transaction laisserait sinon le
   * brouillon bloqué pour toujours, et l'agent finirait par tout resoumettre.
   */
  reclaim: (
    schoolId: string,
    keyId: string,
    id: string,
    tool: string,
    checksum: string,
    staleBefore: Date,
    now: Date
  ) =>
    db.mcpDraft.updateMany({
      where: {
        id,
        schoolId,
        keyId,
        tool,
        checksum,
        status: 'COMMITTED',
        result: { equals: Prisma.DbNull },
        committedAt: { lt: staleBefore },
      },
      data: { committedAt: now },
    }),

  /**
   * Rend le verrou après une transaction qui n'a rien écrit — un refus métier constaté
   * au commit, ou une erreur inattendue. Sans lui, l'appelant attendrait le délai
   * d'abandon pour rejouer un brouillon pourtant intact.
   */
  release: (schoolId: string, id: string) =>
    db.mcpDraft.updateMany({
      where: { id, schoolId, status: 'COMMITTED', result: { equals: Prisma.DbNull } },
      data: { status: 'PENDING', committedAt: null },
    }),

  /**
   * Supprime les brouillons hors d'usage, et rend enfin `@@index([expiresAt])` utile.
   *
   * Un brouillon engagé n'est supprimé que si son expiration ET son `committedAt` sont hors
   * rétention : `reclaim()` re-date un verrou abandonné sans regarder l'expiration, donc un
   * brouillon vieux d'une semaine peut être engagé à l'instant, et le supprimer arracherait la
   * ligne au milieu de sa transaction.
   *
   * La requête passe par l'exception nommée du garde tenant : une purge de rétention n'a pas de
   * `schoolId` à produire, et le garde refuse — à raison — un `deleteMany` non scopé sur `db`.
   */
  purgeExpired: (now: Date, committedBefore: Date) => purgeExpiredMcpDrafts(now, committedBefore),
}
