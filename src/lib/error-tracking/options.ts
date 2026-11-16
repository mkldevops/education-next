type ErrorTrackingEnv = {
  SENTRY_DSN?: string
  SENTRY_ENVIRONMENT?: string
  NODE_ENV?: string
}

export type ClientErrorTrackingOptions = {
  dsn: string
  environment: string
  sendDefaultPii: false
}

export type ErrorTrackingOptions = ClientErrorTrackingOptions & { tracesSampleRate: 0 }

/** Navigateur : erreurs seules, sans donnée personnelle ; le traçage n'y est pas chargé. */
export function clientErrorTrackingOptions(
  dsn: string | undefined,
  environment: string | undefined
): ClientErrorTrackingOptions | null {
  const trimmed = dsn?.trim()
  if (!trimmed) return null
  return {
    dsn: trimmed,
    environment: environment?.trim() || 'production',
    sendDefaultPii: false,
  }
}

/** GlitchTip ne garde que les erreurs : aucune trace de performance, aucune donnée personnelle. */
export function errorTrackingOptions(
  dsn: string | undefined,
  environment: string | undefined
): ErrorTrackingOptions | null {
  const client = clientErrorTrackingOptions(dsn, environment)
  return client && { ...client, tracesSampleRate: 0 }
}

export function serverErrorTrackingOptions(env: ErrorTrackingEnv): ErrorTrackingOptions | null {
  if (env.NODE_ENV === 'test') return null
  return errorTrackingOptions(env.SENTRY_DSN, env.SENTRY_ENVIRONMENT)
}
