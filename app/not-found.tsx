import { ErrorPageShell } from '@/features/error-pages'

export default function RootNotFound() {
  return (
    <html lang="fr">
      <body>
        <ErrorPageShell
          statusCode="404"
          title="Page introuvable"
          description="La page que vous recherchez n'existe pas ou a été déplacée."
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
