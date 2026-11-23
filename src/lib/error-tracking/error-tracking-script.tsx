import { ErrorTrackingInit } from './error-tracking-init'

/** Rien n'est chargé côté navigateur sans `SENTRY_DSN`. */
export function ErrorTrackingScript() {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return null
  return <ErrorTrackingInit dsn={dsn} environment={process.env.SENTRY_ENVIRONMENT} />
}
