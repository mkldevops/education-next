import * as Sentry from '@sentry/nextjs'
import { serverErrorTrackingOptions } from '@/lib/error-tracking/options'

/**
 * Suivi des erreurs vers GlitchTip (API Sentry), lu à l'exécution : sans `SENTRY_DSN`, rien n'est
 * envoyé. Une même image sert toutes les écoles, `SENTRY_ENVIRONMENT` les distingue.
 */
export function register() {
  const options = serverErrorTrackingOptions(process.env)
  if (options) Sentry.init(options)
}

export const onRequestError = Sentry.captureRequestError
