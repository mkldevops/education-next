import type { BetterAuthClientPlugin } from 'better-auth/client'
import type { impersonation } from './impersonation'

export const impersonationClient = () =>
  ({
    id: 'impersonation',
    $InferServerPlugin: {} as ReturnType<typeof impersonation>,
    pathMethods: {
      '/admin/impersonate-user': 'POST',
      '/admin/stop-impersonating': 'POST',
    },
    atomListeners: [
      {
        matcher: (path) =>
          path === '/admin/impersonate-user' || path === '/admin/stop-impersonating',
        signal: '$sessionSignal',
      },
    ],
  }) satisfies BetterAuthClientPlugin
