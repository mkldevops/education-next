import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const { internalPath } = await import('./mcp-app-frame')

const origin = 'https://ecole.test'

describe('internalPath', () => {
  it('keeps a dashboard page of the application', () => {
    expect(internalPath(`${origin}/dashboard/families/f-1`, origin)).toBe('/dashboard/families/f-1')
  })

  it('refuses another origin, another path or an invalid URL', () => {
    expect(internalPath('https://evil.test/dashboard/families/f-1', origin)).toBeNull()
    expect(internalPath(`${origin}/api/auth/sign-out`, origin)).toBeNull()
    expect(internalPath('javascript:alert(1)', origin)).toBeNull()
    expect(internalPath('not a url', origin)).toBeNull()
  })
})
