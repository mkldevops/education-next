import { routing } from '@/i18n/routing'

export const DEFAULT_AUTH_REDIRECT = '/dashboard'

const MAX_REDIRECT_LENGTH = 2048

const hasControlCharacter = (value: string) =>
  [...value].some((character) => (character.codePointAt(0) ?? 0) < 0x20)

/**
 * Chemin de retour après connexion, tel qu'il arrive dans `?redirectTo=`.
 *
 * Seul un chemin interne passe : `//evil.test` ou `/\evil.test` seraient résolus par le
 * navigateur comme une autre origine, d'où un repli sur le dashboard plutôt qu'une redirection
 * ouverte. Le préfixe de langue est retiré, le routeur localisé le remet lui-même.
 */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_AUTH_REDIRECT
  if (value.length > MAX_REDIRECT_LENGTH || hasControlCharacter(value)) {
    return DEFAULT_AUTH_REDIRECT
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return DEFAULT_AUTH_REDIRECT
  }

  const segments = value.split('/')
  const withoutLocale = routing.locales.some((locale) => locale === segments[1])
    ? `/${segments.slice(2).join('/')}`
    : value

  return withoutLocale === '/' ? DEFAULT_AUTH_REDIRECT : withoutLocale
}
