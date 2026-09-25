import type { BetterAuthPlugin } from 'better-auth'
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  getSessionFromCtx,
} from 'better-auth/api'
import { deleteSessionCookie, expireCookie, setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import {
  checkImpersonation,
  type ImpersonationLock,
  isImpersonating,
  type ManagedUser,
} from '@/domain/user'
import type { ImpersonationStart } from '@/gateways/impersonation-log-gateway'

const IMPERSONATION_SESSION_SECONDS = 60 * 60
const ADMIN_SESSION_COOKIE = 'admin_session'
const IMPERSONATING: ImpersonationLock = 'impersonating'

/**
 * Routes natives de Better Auth qui touchent aux identifiants ou au compte lui-même,
 * refusées pendant un emprunt. Le crochet `before` s'applique aux appels HTTP de
 * `/api/auth/*` comme aux appels serveur `auth.api.*` : les actions qui les relaient
 * n'ont pas de chemin de contournement.
 */
export const IMPERSONATION_LOCKED_AUTH_PATHS: ReadonlySet<string> = new Set([
  '/change-password',
  '/set-password',
  '/change-email',
  '/update-user',
  '/delete-user',
  '/delete-user/callback',
  '/revoke-session',
  '/revoke-sessions',
  '/revoke-other-sessions',
  '/link-social',
  '/unlink-account',
  '/get-access-token',
  '/refresh-token',
])

type ImpersonationLog = {
  recordStart: (entry: ImpersonationStart) => Promise<void>
  recordEnd: (sessionId: string) => Promise<void>
}

type ImpersonationOptions = {
  findUser: (id: string) => Promise<ManagedUser | null>
  log: ImpersonationLog
}

function impersonatingError() {
  return new APIError('FORBIDDEN', { code: IMPERSONATING, message: IMPERSONATING })
}

/**
 * Emprunt d'identité réservé aux super-admins.
 *
 * Reprend la mécanique du plugin `admin` de Better Auth — mêmes routes, même cookie signé
 * de retour, même colonne `Session.impersonatedBy` — sans ses rôles : le droit se lit sur
 * `User.isSuperAdmin`, relu en base, et aucune des autres routes `/admin/*` n'est exposée.
 *
 * Deux ajouts par rapport à l'amont : chaque emprunt laisse une ligne `ImpersonationLog`
 * (ouverte au démarrage, close à l'arrêt ou à la déconnexion), et les routes de
 * `IMPERSONATION_LOCKED_AUTH_PATHS` répondent `impersonating` pendant l'emprunt.
 */
export const impersonation = (options: ImpersonationOptions) =>
  ({
    id: 'impersonation',
    schema: {
      session: {
        fields: {
          impersonatedBy: { type: 'string', required: false, input: false },
        },
      },
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => IMPERSONATION_LOCKED_AUTH_PATHS.has(ctx.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => {
            const current = await getSessionFromCtx(ctx)
            if (isImpersonating(current)) throw impersonatingError()
          }),
        },
        {
          // Une déconnexion pendant l'emprunt supprime la session empruntée sans passer par
          // `/admin/stop-impersonating` : la trace doit être close ici aussi.
          matcher: (ctx) => ctx.path === '/sign-out',
          handler: createAuthMiddleware(async (ctx) => {
            const current = await getSessionFromCtx(ctx)
            if (current && isImpersonating(current)) await options.log.recordEnd(current.session.id)
          }),
        },
      ],
    },
    endpoints: {
      impersonateUser: createAuthEndpoint(
        '/admin/impersonate-user',
        {
          method: 'POST',
          body: z.object({ userId: z.string().min(1) }),
        },
        async (ctx) => {
          const current = await getAuthoritativeSessionFromCtx(ctx)
          if (!current) throw new APIError('UNAUTHORIZED')

          const [actor, target] = await Promise.all([
            options.findUser(current.user.id),
            options.findUser(ctx.body.userId),
          ])
          if (!actor) throw new APIError('UNAUTHORIZED')
          if (!target) throw new APIError('NOT_FOUND', { code: 'notFound', message: 'notFound' })

          const verdict = checkImpersonation(actor, target, isImpersonating(current))
          if (verdict !== 'OK') throw new APIError('FORBIDDEN', { code: verdict, message: verdict })

          const targetUser = await ctx.context.internalAdapter.findUserById(target.id)
          if (!targetUser)
            throw new APIError('NOT_FOUND', { code: 'notFound', message: 'notFound' })

          const session = await ctx.context.internalAdapter.createSession(
            targetUser.id,
            true,
            {
              impersonatedBy: current.user.id,
              expiresAt: new Date(Date.now() + IMPERSONATION_SESSION_SECONDS * 1000),
            },
            true
          )
          if (!session) throw new APIError('INTERNAL_SERVER_ERROR')

          // Pas d'emprunt sans trace : si la ligne ne peut être écrite, la session empruntée
          // est retirée avant qu'un cookie ne la désigne.
          try {
            await options.log.recordStart({
              actorId: current.user.id,
              actorEmail: current.user.email,
              targetId: targetUser.id,
              targetEmail: targetUser.email,
              sessionId: session.id,
              ipAddress: session.ipAddress ?? null,
              userAgent: session.userAgent ?? null,
              expiresAt: session.expiresAt,
            })
          } catch {
            await ctx.context.internalAdapter.deleteSession(session.token)
            throw new APIError('INTERNAL_SERVER_ERROR')
          }

          const authCookies = ctx.context.authCookies
          deleteSessionCookie(ctx)
          const dontRememberMe = await ctx.getSignedCookie(
            authCookies.dontRememberToken.name,
            ctx.context.secret
          )
          await ctx.setSignedCookie(
            ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE).name,
            `${current.session.token}:${dontRememberMe || ''}`,
            ctx.context.secret,
            authCookies.sessionToken.attributes
          )
          await setSessionCookie(ctx, { session, user: targetUser }, true)

          return ctx.json({ userId: targetUser.id })
        }
      ),
      stopImpersonating: createAuthEndpoint(
        '/admin/stop-impersonating',
        { method: 'POST', requireHeaders: true },
        async (ctx) => {
          const current = await getAuthoritativeSessionFromCtx(ctx)
          if (!current) throw new APIError('UNAUTHORIZED')

          const impersonatedBy = current.session.impersonatedBy
          if (!isImpersonating(current) || typeof impersonatedBy !== 'string') {
            throw new APIError('BAD_REQUEST', {
              code: 'notImpersonating',
              message: 'notImpersonating',
            })
          }

          const adminCookie = ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE)
          const stored = await ctx.getSignedCookie(adminCookie.name, ctx.context.secret)
          if (!stored) throw new APIError('UNAUTHORIZED')

          const [adminToken, dontRememberMe] = stored.split(':')
          const adminSession = await ctx.context.internalAdapter.findSession(adminToken)
          if (!adminSession || adminSession.session.userId !== impersonatedBy) {
            throw new APIError('UNAUTHORIZED')
          }

          await options.log.recordEnd(current.session.id)
          await ctx.context.internalAdapter.deleteSession(current.session.token)
          await setSessionCookie(ctx, adminSession, !!dontRememberMe)
          expireCookie(ctx, adminCookie)

          return ctx.json({ userId: adminSession.user.id })
        }
      ),
    },
  }) satisfies BetterAuthPlugin
