import { ErrorPageShell } from '@/features/error-pages'

export default function RootForbidden() {
  return (
    <html lang="fr">
      <body>
        <ErrorPageShell
          statusCode="403"
          title="Accès interdit"
          description="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
          actions={[
            {
              href: '/fr',
              icon: 'home',
              label: "Retour à l'accueil",
              variant: 'default',
            },
          ]}
        />
      </body>
    </html>
  )
}
