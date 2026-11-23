import * as Sentry from '@sentry/nextjs'
import type { CaptureError } from './client-error-tracking'
import type { ClientErrorTrackingOptions } from './options'

/**
 * Chargé à la demande par `client-error-tracking` : seul module client autorisé à importer
 * `@sentry/nextjs` statiquement. Pas de traçage de performance côté navigateur.
 */
export function initSentry(options: ClientErrorTrackingOptions): CaptureError {
  if (!Sentry.getClient()) {
    Sentry.init({
      ...options,
      integrations: (defaults) => defaults.filter(({ name }) => name !== 'BrowserTracing'),
    })
  }
  return (error, unhandled) => {
    Sentry.captureException(
      error,
      unhandled ? { mechanism: { type: 'onerror.deferred', handled: false } } : undefined
    )
  }
}
