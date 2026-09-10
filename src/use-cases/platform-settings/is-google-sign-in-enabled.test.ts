import { describe, expect, it, vi } from 'vitest'
import { isGoogleSignInEnabled } from './is-google-sign-in-enabled'

type GetSetting = NonNullable<Parameters<typeof isGoogleSignInEnabled>[0]>

const reading = (result: unknown) => vi.fn(async () => result) as unknown as GetSetting

describe('isGoogleSignInEnabled', () => {
  it('is enabled when no setting row exists', async () => {
    await expect(isGoogleSignInEnabled(reading('notFound'))).resolves.toBe(true)
  })

  it('is disabled when the setting holds false', async () => {
    await expect(
      isGoogleSignInEnabled(
        reading({ id: 's', name: 'google_sign_in_enabled', value: 'false', valueType: 'BOOLEAN' })
      )
    ).resolves.toBe(false)
  })

  it('is enabled when the setting holds true', async () => {
    await expect(
      isGoogleSignInEnabled(
        reading({ id: 's', name: 'google_sign_in_enabled', value: 'true', valueType: 'BOOLEAN' })
      )
    ).resolves.toBe(true)
  })

  it('asks for the google sign-in setting by name', async () => {
    const getSetting = reading('notFound')

    await isGoogleSignInEnabled(getSetting)

    expect(getSetting).toHaveBeenCalledWith({ name: 'google_sign_in_enabled' })
  })
})
