import type { McpOAuthTokenKind } from '@/domain/mcp-oauth'
import { db } from '@/lib/db'

const grantSelect = {
  id: true,
  schoolId: true,
  userId: true,
  clientId: true,
  clientName: true,
  resource: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} as const

const tokenSelect = {
  id: true,
  kind: true,
  grantId: true,
  codeChallenge: true,
  redirectUri: true,
  expiresAt: true,
  consumedAt: true,
  revokedAt: true,
  grant: { select: grantSelect },
} as const

export type IssuedSecret = { tokenHash: string; prefix: string; expiresAt: Date }

type Issue = { access: IssuedSecret; refresh: IssuedSecret }

/**
 * Seule frontière de `McpOAuthGrant` et de `McpOAuthToken`.
 *
 * `McpOAuthToken` est hors garde tenant : un jeton se résout par son hachage avant que
 * l'école soit connue, exactement comme `McpApiKey`. `McpOAuthGrant` y est soumis, et
 * chaque écriture ci-dessous porte donc le `schoolId` relu sur la connexion.
 *
 * La consommation d'un code ou d'un jeton de rafraîchissement est un `updateMany`
 * conditionnel : deux échanges concurrents du même secret n'en voient passer qu'un, et
 * le perdant, qui revoit un secret déjà consommé, révoque la connexion entière.
 */
export const mcpOAuthGrantGateway = {
  /** Connexion et code d'autorisation naissent ensemble : un code sans connexion n'existe pas. */
  createWithCode: (
    grant: {
      schoolId: string
      userId: string
      clientId: string
      clientName: string
      resource: string
    },
    code: IssuedSecret & { codeChallenge: string; redirectUri: string }
  ) =>
    db.mcpOAuthGrant.create({
      data: {
        ...grant,
        tokens: { create: { kind: 'CODE', ...code } },
      },
      select: { id: true },
    }),

  findTokenByHash: (tokenHash: string) =>
    db.mcpOAuthToken.findUnique({ where: { tokenHash }, select: tokenSelect }),

  /**
   * Consomme un secret d'un genre donné et émet la paire suivante dans la même
   * transaction. `null` signifie que le secret n'était plus consommable : déjà pris,
   * révoqué, expiré ou d'un autre genre.
   */
  consumeAndIssue: (
    tokenId: string,
    kind: McpOAuthTokenKind,
    grantId: string,
    now: Date,
    issue: Issue
  ) =>
    db.$transaction(async (tx) => {
      const { count } = await tx.mcpOAuthToken.updateMany({
        where: {
          id: tokenId,
          kind,
          grantId,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      })
      if (count !== 1) return null

      await tx.mcpOAuthToken.createMany({
        data: [
          { grantId, kind: 'ACCESS', ...issue.access },
          { grantId, kind: 'REFRESH', ...issue.refresh },
        ],
      })
      return { issued: true as const }
    }),

  /** Connexions d'un utilisateur sur une école, révoquées comprises. */
  listForUser: (userId: string, schoolId: string) =>
    db.mcpOAuthGrant.findMany({
      where: { userId, schoolId },
      select: grantSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),

  /**
   * Révocation scopée sur `(id, userId, schoolId)`, comme `mcpApiKeyGateway.revoke` :
   * `count === 0` couvre l'inexistant, l'étranger et le déjà révoqué sans les distinguer.
   */
  revokeForUser: (id: string, userId: string, schoolId: string, now: Date) =>
    db.mcpOAuthGrant.updateMany({
      where: { id, userId, schoolId, revokedAt: null },
      data: { revokedAt: now },
    }),

  /** Révocation par le serveur lui-même : rejeu d'un code, `revocation_endpoint`. */
  revoke: (id: string, schoolId: string, now: Date) =>
    db.mcpOAuthGrant.updateMany({
      where: { id, schoolId, revokedAt: null },
      data: { revokedAt: now },
    }),

  touch: (id: string, schoolId: string, now: Date, staleBefore: Date) =>
    db.mcpOAuthGrant.updateMany({
      where: { id, schoolId, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: staleBefore } }] },
      data: { lastUsedAt: now },
    }),

  /**
   * Retire les secrets qui ne peuvent plus servir. Un jeton consommé ou révoqué reste en
   * base jusqu'à son expiration : c'est ce qui permet de reconnaître un rejeu et de
   * révoquer la connexion qui le subit.
   */
  purgeExpiredTokens: async (now: Date) => {
    const { count } = await db.mcpOAuthToken.deleteMany({ where: { expiresAt: { lte: now } } })
    return count
  },
}
