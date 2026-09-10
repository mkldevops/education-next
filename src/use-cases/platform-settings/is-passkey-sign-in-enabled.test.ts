import { describe, expect, it, vi } from 'vitest'
import { isPasskeySignInEnabled } from './is-passkey-sign-in-enabled'

type GetSetting = NonNullable<Parameters<typeof isPasskeySignInEnabled>[0]>

const reading = (result: unknown) => vi.fn(async () => result) as unknown as GetSetting

describe('isPasskeySignInEnabled', () => {
  it('is enabled when no setting row exists', async () => {
    await expect(isPasskeySignInEnabled(reading('notFound'))).resolves.toBe(true)
  })

  it('is disabled when the setting holds false', async () => {
    await expect(
      isPasskeySignInEnabled(
        reading({ id: 's', name: 'passkey_sign_in_enabled', value: 'false', valueType: 'BOOLEAN' })
      )
    ).resolves.toBe(false)
  })

  it('is enabled when the setting holds true', async () => {
    await expect(
      isPasskeySignInEnabled(
        reading({ id: 's', name: 'passkey_sign_in_enabled', value: 'true', valueType: 'BOOLEAN' })
      )
    ).resolves.toBe(true)
  })

  it('asks for the passkey sign-in setting by name', async () => {
    const getSetting = reading('notFound')

    await isPasskeySignInEnabled(getSetting)

    expect(getSetting).toHaveBeenCalledWith({ name: 'passkey_sign_in_enabled' })
  })
})
