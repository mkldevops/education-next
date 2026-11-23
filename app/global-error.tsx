'use client'

import { useEffect } from 'react'
import { ErrorPageShell } from '@/features/error-pages'
import { captureClientException } from '@/lib/error-tracking/client-error-tracking'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureClientException(error)
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
