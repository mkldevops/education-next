import { beforeEach, describe, expect, it, vi } from 'vitest'

let googleConfigured = true

vi.mock('@/lib/social-providers', () => ({
  get isGoogleConfigured() {
    return googleConfigured
  },
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy.
const { isGoogleSignInAvailable } = await import('./is-google-sign-in-available')

type GetSetting = NonNullable<Parameters<typeof isGoogleSignInAvailable>[0]>

const reading = (result: unknown) => vi.fn(async () => result) as unknown as GetSetting

beforeEach(() => {
  googleConfigured = true
})

describe('isGoogleSignInAvailable', () => {
  it('never reads the platform setting when Google is not configured', async () => {
    googleConfigured = false
    const getSetting = reading('notFound')

    await expect(isGoogleSignInAvailable(getSetting)).resolves.toBe(false)
    expect(getSetting).not.toHaveBeenCalled()
  })

  it('is unavailable when configured but the flag is disabled', async () => {
    const getSetting = reading({
      id: 's',
      name: 'google_sign_in_enabled',
      value: 'false',
      valueType: 'BOOLEAN',
    })

    await expect(isGoogleSignInAvailable(getSetting)).resolves.toBe(false)
  })

  it('is available when configured and the flag is enabled', async () => {
    const getSetting = reading({
      id: 's',
      name: 'google_sign_in_enabled',
      value: 'true',
      valueType: 'BOOLEAN',
    })

    await expect(isGoogleSignInAvailable(getSetting)).resolves.toBe(true)
  })
})
