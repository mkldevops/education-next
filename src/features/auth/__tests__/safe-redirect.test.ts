import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['fr', 'en'], defaultLocale: 'fr' },
}))

import { DEFAULT_AUTH_REDIRECT, safeRedirectPath } from '../safe-redirect'

describe('safeRedirectPath', () => {
  it('keeps an internal path with its query string', () => {
    expect(safeRedirectPath('/dashboard/families?tab=children')).toBe(
      '/dashboard/families?tab=children'
    )
  })

  it('drops the locale prefix, which the localized router adds back', () => {
    expect(safeRedirectPath('/en/invite/abc')).toBe('/invite/abc')
    expect(safeRedirectPath('/fr')).toBe(DEFAULT_AUTH_REDIRECT)
  })

  it.each([
    undefined,
    ['/dashboard'],
    '',
    'dashboard',
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/dashboard\n',
    `/${'a'.repeat(2100)}`,
  ])('falls back to the dashboard for %j', (value) => {
    expect(safeRedirectPath(value)).toBe(DEFAULT_AUTH_REDIRECT)
  })

  // Une requête `/oauth/authorize` rejouée après connexion porte `state`, `code_challenge`
  // et deux URL : elle dépasse largement une ancienne limite de 512 caractères.
  it('keeps a long internal path such as a replayed authorization request', () => {
    const authorize = `/oauth/authorize?state=${'s'.repeat(900)}&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fcb`

    expect(safeRedirectPath(authorize)).toBe(authorize)
  })
})
