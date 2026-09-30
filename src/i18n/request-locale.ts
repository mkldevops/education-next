import { defaultLocale, isLocale, type Locale } from './locales'

/**
 * Nom par défaut du cookie posé par le middleware next-intl (`routing.localeCookie` n'est
 * pas surchargé dans `routing.ts`). Il reflète la dernière langue visitée : c'est la source
 * la plus fiable pour un appel hors segment `[locale]`, comme `/api/auth/*`.
 */
const LOCALE_COOKIE = 'NEXT_LOCALE'

function readCookieLocale(cookieHeader: string | null): Locale | undefined {
  if (!cookieHeader) return undefined
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=')
    if (separator === -1) continue
    if (pair.slice(0, separator).trim() !== LOCALE_COOKIE) continue
    const value = decodeURIComponent(pair.slice(separator + 1).trim())
    return isLocale(value) ? value : undefined
  }
  return undefined
}

/** Première langue supportée dans l'ordre de préférence `Accept-Language` (facteur `q`). */
function readAcceptLanguageLocale(header: string | null): Locale | undefined {
  if (!header) return undefined
  const ranked = header
    .split(',')
    .map((entry, index) => {
      const [tag = '', ...params] = entry.trim().split(';')
      const quality = params.map((param) => param.trim()).find((param) => param.startsWith('q='))
      const q = quality ? Number.parseFloat(quality.slice(2)) : 1
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q, index }
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)

  for (const { tag } of ranked) {
    const primary = tag.split('-')[0] ?? ''
    if (isLocale(primary)) return primary
  }
  return undefined
}

/**
 * Locale d'une requête reçue hors segment `[locale]` : cookie `NEXT_LOCALE`, puis
 * `Accept-Language`, puis la locale par défaut. Sans requête (appel serveur direct), la
 * locale par défaut s'applique.
 */
export function resolveRequestLocale(request?: Pick<Request, 'headers'>): Locale {
  if (!request) return defaultLocale
  return (
    readCookieLocale(request.headers.get('cookie')) ??
    readAcceptLanguageLocale(request.headers.get('accept-language')) ??
    defaultLocale
  )
}
