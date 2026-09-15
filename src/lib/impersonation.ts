import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint, getAuthoritativeSessionFromCtx } from 'better-auth/api'
import { deleteSessionCookie, expireCookie, setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import { checkImpersonation, type ManagedUser } from '@/domain/user'

const IMPERSONATION_SESSION_SECONDS = 60 * 60
const ADMIN_SESSION_COOKIE = 'admin_session'

type ImpersonationOptions = {
  findUser: (id: string) => Promise<ManagedUser | null>
}

/**
 * Emprunt d'identité réservé aux super-admins.
 *
 * Reprend la mécanique du plugin `admin` de Better Auth — mêmes routes, même cookie signé
 * de retour, même colonne `Session.impersonatedBy` — sans ses rôles : le droit se lit sur
 * `User.isSuperAdmin`, relu en base, et aucune des autres routes `/admin/*` n'est exposée.
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

          const isImpersonating = typeof current.session.impersonatedBy === 'string'
          const verdict = checkImpersonation(actor, target, isImpersonating)
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
          if (typeof impersonatedBy !== 'string') {
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

          await ctx.context.internalAdapter.deleteSession(current.session.token)
          await setSessionCookie(ctx, adminSession, !!dontRememberMe)
          expireCookie(ctx, adminCookie)

          return ctx.json({ userId: adminSession.user.id })
        }
      ),
    },
  }) satisfies BetterAuthPlugin
