import type { ClientErrorTrackingOptions } from './options'

/**
 * Suivi des erreurs côté navigateur sans Sentry dans le JS initial : seul ce module est chargé au
 * démarrage. Il retient les erreurs survenues avant le chargement différé de Sentry, puis les lui
 * transmet. Aucun import statique de `@sentry/*` ici, sinon le SDK revient dans le chunk initial.
 */

/** `unhandled` distingue une erreur globale non rattrapée d'une erreur remontée par le code. */
export type CaptureError = (error: unknown, unhandled: boolean) => void

type SentryClientModule = { initSentry: (options: ClientErrorTrackingOptions) => CaptureError }

const MAX_BUFFERED_ERRORS = 20

let pending: { error: unknown; unhandled: boolean }[] = []
let capture: CaptureError | null = null
let loading: Promise<void> | null = null
let removeListeners: (() => void) | null = null

function enqueue(error: unknown, unhandled: boolean) {
  if (pending.length < MAX_BUFFERED_ERRORS) pending.push({ error, unhandled })
}

/** Écoute les erreurs globales jusqu'à ce que Sentry prenne le relais avec ses propres écouteurs. */
export function bufferGlobalErrors(target: Window) {
  if (removeListeners || capture) return
  const onError = (event: ErrorEvent) => enqueue(event.error ?? event.message, true)
  const onRejection = (event: PromiseRejectionEvent) => enqueue(event.reason, true)
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  removeListeners = () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
    removeListeners = null
  }
}

/** Remplace `Sentry.captureException` côté client : l'erreur attend le SDK s'il n'est pas chargé. */
export function captureClientException(error: unknown) {
  if (capture) capture(error, false)
  else enqueue(error, false)
}

/** Charge Sentry, l'initialise, rejoue les erreurs retenues et retire les écouteurs temporaires. */
export function startClientErrorTracking(
  options: ClientErrorTrackingOptions,
  load: () => Promise<SentryClientModule> = () => import('./sentry-client')
): Promise<void> {
  loading ??= load()
    .then(({ initSentry }) => {
      const send = initSentry(options)
      capture = send
      removeListeners?.()
      const queued = pending
      pending = []
      for (const { error, unhandled } of queued) send(error, unhandled)
    })
    .catch(() => {
      // Chunk introuvable (déploiement entre deux chargements, réseau) : les erreurs restent
      // retenues et un prochain appel retente le chargement.
      loading = null
    })
  return loading
}
