import { createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import { auth } from '@/lib/auth'

// Not registered as a Better Auth plugin, so this path is never routed or publicly reachable.
// It exists only to give `setSessionCookie` the endpoint context it requires.
const createSessionEndpoint = createAuthEndpoint(
  '/internal/create-session',
  {
    method: 'POST',
    body: z.object({ userId: z.string() }),
  },
  async (ctx) => {
    const user = await ctx.context.internalAdapter.findUserById(ctx.body.userId)
    if (!user) return ctx.json({ created: false })

    const session = await ctx.context.internalAdapter.createSession(ctx.body.userId)
    await setSessionCookie(ctx, { session, user })

    return ctx.json({ created: true })
  }
)

export const sessionGateway = {
  async createForUser(userId: string, requestHeaders: Headers): Promise<string[]> {
    const context = await auth.$context

    const { headers, response } = await createSessionEndpoint({
      context,
      headers: requestHeaders,
      body: { userId },
      returnHeaders: true,
    })

    if (!response?.created) return []

    return headers.getSetCookie()
  },
}
