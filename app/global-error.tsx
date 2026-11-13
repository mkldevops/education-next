'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { ErrorPageShell } from '@/features/error-pages'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="fr">
      <body>
        <ErrorPageShell
          statusCode="500"
          title="Erreur critique"
          description="Une erreur inattendue s'est produite. Veuillez recharger la page."
          onRetry={reset}
          retryLabel="Réessayer"
          actions={[
            {
              href: '/fr',
              icon: 'home',
              label: "Retour à l'accueil",
            },
          ]}
        />
      </body>
    </html>
  )
}
