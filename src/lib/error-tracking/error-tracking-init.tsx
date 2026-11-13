'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { errorTrackingOptions } from './options'

/** Le DSN arrive du serveur : l'image reste la même pour chaque école, sans variable de build. */
export function ErrorTrackingInit({ dsn, environment }: { dsn: string; environment?: string }) {
  useEffect(() => {
    if (Sentry.getClient()) return
    const options = errorTrackingOptions(dsn, environment)
    if (options) Sentry.init(options)
  }, [dsn, environment])

  return null
}
