import sharp from 'sharp'

/** Formats que le rendu de `next/og` sait dessiner ; une icône `.ico` n'en fait pas partie. */
const DRAWABLE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

/**
 * Charge le logo pour le favicon généré. `next/og` refuse une source relative, or un logo
 * téléversé est servi sous `/api/media/…` : il est résolu contre l'URL publique de
 * l'application, jamais contre l'en-tête `Host` fourni par le client. L'image est intégrée
 * en data URI, et tout échec rend `null` pour que le favicon par défaut s'affiche.
 *
 * `next/og` plante sur un WebP, format de tout logo téléversé : il est converti en PNG.
 */
export async function loadLogoDataUrl(logoUrl: string, fetcher: typeof fetch = fetch) {
  try {
    const url = new URL(logoUrl, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    const response = await fetcher(url, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) return null

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
    const bytes = Buffer.from(await response.arrayBuffer())

    if (contentType === 'image/webp') {
      const png = await sharp(bytes).png().toBuffer()
      return `data:image/png;base64,${png.toString('base64')}`
    }
    if (!DRAWABLE_TYPES.includes(contentType)) return null

    return `data:${contentType};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}
