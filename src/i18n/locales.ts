/**
 * Locales supportées, sans dépendance à next-intl : ce module peut être importé par du code
 * hors rendu (callbacks Better Auth, tests) là où `routing.ts` embarque la navigation.
 */
export const locales = ['fr', 'en'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}
