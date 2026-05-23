import { ErrorPageShell } from '@/features/error-pages'

export default function RootUnauthorized() {
  return (
    <html lang="fr">
      <body>
        <ErrorPageShell
          statusCode="401"
          title="Non authentifié"
          description="Vous devez être connecté pour accéder à cette page."
          actions={[
            {
              href: '/fr/login',
              icon: 'login',
              label: 'Se connecter',
              variant: 'default',
            },
          ]}
        />
      </body>
    </html>
  )
}
