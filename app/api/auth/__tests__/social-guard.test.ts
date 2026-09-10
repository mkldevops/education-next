import { beforeEach, describe, expect, it, vi } from 'vitest'

const isGoogleSignInEnabledMock = vi.fn()
const handlerGetMock = vi.fn()
const handlerPostMock = vi.fn()

vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: () => ({ GET: handlerGetMock, POST: handlerPostMock }),
}))
vi.mock('@/lib/auth', () => ({ auth: {} }))
vi.mock('@/use-cases/platform-settings/is-google-sign-in-enabled', () => ({
  isGoogleSignInEnabled: isGoogleSignInEnabledMock,
}))

const { GET, POST } = await import('../[...all]/route')

const request = (path: string) => new Request(`http://localhost:8550${path}`, { method: 'POST' })

beforeEach(() => {
  vi.clearAllMocks()
  handlerGetMock.mockResolvedValue(new Response('delegated'))
  handlerPostMock.mockResolvedValue(new Response('delegated'))
})

describe('social sign-in guard', () => {
  it('refuses every social entry point when Google is disabled', async () => {
    isGoogleSignInEnabledMock.mockResolvedValue(false)

    for (const path of ['/api/auth/sign-in/social', '/api/auth/link-social']) {
      const response = await POST(request(path))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'signInDisabled' })
    }
    expect(handlerPostMock).not.toHaveBeenCalled()
  })

  it('refuses the provider callback so a flow opened before the switch cannot land', async () => {
    isGoogleSignInEnabledMock.mockResolvedValue(false)

    const response = await GET(request('/api/auth/callback/google?state=abc&code=def'))

    expect(response.status).toBe(403)
    expect(handlerGetMock).not.toHaveBeenCalled()
  })

  it('ignores a path that merely ends with a social segment', async () => {
    isGoogleSignInEnabledMock.mockResolvedValue(false)

    await POST(request('/api/auth/callback-for/link-social'))

    expect(handlerPostMock).toHaveBeenCalled()
  })

  it('delegates social requests when Google is enabled', async () => {
    isGoogleSignInEnabledMock.mockResolvedValue(true)

    await POST(request('/api/auth/sign-in/social'))

    expect(handlerPostMock).toHaveBeenCalled()
  })

  it('never reads the flag for unrelated auth traffic', async () => {
    await POST(request('/api/auth/sign-in/email'))

    expect(isGoogleSignInEnabledMock).not.toHaveBeenCalled()
    expect(handlerPostMock).toHaveBeenCalled()
  })
})
