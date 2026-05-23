'use client'

import { ErrorPageShell } from '@/features/error-pages'

export default function GlobalError({ reset }: { reset: () => void }) {
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
