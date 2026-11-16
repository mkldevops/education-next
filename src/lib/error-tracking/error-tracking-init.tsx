'use client'

import { useEffect } from 'react'
import { bufferGlobalErrors, startClientErrorTracking } from './client-error-tracking'
import { clientErrorTrackingOptions } from './options'

// Dès l'évaluation du chunk, avant l'hydratation : les erreurs précoces ne sont pas perdues.
if (typeof window !== 'undefined') bufferGlobalErrors(window)

/** Repousse le chargement de Sentry après le rendu initial, sans dépasser deux secondes. */
function whenIdle(task: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(task, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(task, 1)
  return () => window.clearTimeout(id)
}

/** Le DSN arrive du serveur : l'image reste la même pour chaque école, sans variable de build. */
export function ErrorTrackingInit({ dsn, environment }: { dsn: string; environment?: string }) {
  useEffect(() => {
    const options = clientErrorTrackingOptions(dsn, environment)
    if (!options) return
    return whenIdle(() => {
      void startClientErrorTracking(options)
    })
  }, [dsn, environment])

  return null
}
