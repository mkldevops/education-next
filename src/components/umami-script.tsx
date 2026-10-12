import Script from 'next/script'

/**
 * Mesure d'audience Umami, lue à l'exécution : sans `UMAMI_SCRIPT_URL` et `UMAMI_WEBSITE_ID`, rien
 * n'est chargé. Les paramètres d'URL ne sont pas envoyés, ils peuvent porter une recherche nominative.
 */
export function UmamiScript() {
  const src = process.env.UMAMI_SCRIPT_URL
  const websiteId = process.env.UMAMI_WEBSITE_ID
  if (!src || !websiteId) return null

  return (
    <Script
      src={src}
      data-website-id={websiteId}
      data-exclude-search="true"
      strategy="afterInteractive"
    />
  )
}
