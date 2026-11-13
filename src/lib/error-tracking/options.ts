type ErrorTrackingEnv = {
  SENTRY_DSN?: string
  SENTRY_ENVIRONMENT?: string
  NODE_ENV?: string
}

export type ErrorTrackingOptions = {
  dsn: string
  environment: string
  tracesSampleRate: 0
  sendDefaultPii: false
}

/** GlitchTip ne garde que les erreurs : aucune trace de performance, aucune donnée personnelle. */
export function errorTrackingOptions(
  dsn: string | undefined,
  environment: string | undefined
): ErrorTrackingOptions | null {
  const trimmed = dsn?.trim()
  if (!trimmed) return null
  return {
    dsn: trimmed,
    environment: environment?.trim() || 'production',
    tracesSampleRate: 0,
    sendDefaultPii: false,
  }
}

export function serverErrorTrackingOptions(env: ErrorTrackingEnv): ErrorTrackingOptions | null {
  if (env.NODE_ENV === 'test') return null
  return errorTrackingOptions(env.SENTRY_DSN, env.SENTRY_ENVIRONMENT)
}
