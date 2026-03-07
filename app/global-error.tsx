'use client'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="fr">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <p className="text-sm font-medium text-red-600">500</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Erreur critique</h1>
          <p className="mt-2 text-center text-gray-600">
            Une erreur inattendue s&apos;est produite. Veuillez recharger la page.
          </p>
          <button
            onClick={reset}
            type="button"
            className="mt-6 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}
