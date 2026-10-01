import { describe, expect, it } from 'vitest'
import { resolveRequestLocale } from '../request-locale'

function requestWith(headers: Record<string, string>) {
  return new Request('http://localhost/api/auth/request-password-reset', { headers })
}

describe('resolveRequestLocale', () => {
  it('falls back to the default locale without a request', () => {
    expect(resolveRequestLocale()).toBe('fr')
    expect(resolveRequestLocale(requestWith({}))).toBe('fr')
  })

  it('reads the next-intl cookie first', () => {
    const request = requestWith({
      cookie: 'education-next.session_token=abc; NEXT_LOCALE=en; other=1',
      'accept-language': 'fr-FR,fr;q=0.9',
    })

    expect(resolveRequestLocale(request)).toBe('en')
  })

  it('ignores a cookie carrying an unsupported locale', () => {
    const request = requestWith({ cookie: 'NEXT_LOCALE=de', 'accept-language': 'en' })

    expect(resolveRequestLocale(request)).toBe('en')
  })

  it('honours the Accept-Language preference order', () => {
    expect(
      resolveRequestLocale(requestWith({ 'accept-language': 'en-US,en;q=0.9,fr;q=0.8' }))
    ).toBe('en')
    expect(resolveRequestLocale(requestWith({ 'accept-language': 'de;q=0.5, en;q=0.4, fr' }))).toBe(
      'fr'
    )
    expect(resolveRequestLocale(requestWith({ 'accept-language': 'de-DE, en-GB;q=0.7' }))).toBe(
      'en'
    )
  })

  it('falls back to the default locale when no supported language is accepted', () => {
    expect(resolveRequestLocale(requestWith({ 'accept-language': 'de, es;q=0.8' }))).toBe('fr')
    expect(resolveRequestLocale(requestWith({ 'accept-language': '*' }))).toBe('fr')
  })
})
