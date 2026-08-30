import { describe, expect, it, vi } from 'vitest'
import { isSchoolSwitchEnabled } from './is-school-switch-enabled'

type GetSetting = Parameters<typeof isSchoolSwitchEnabled>[0]

const reading = (result: unknown) => vi.fn(async () => result) as unknown as GetSetting

describe('isSchoolSwitchEnabled', () => {
  it('is enabled when no setting row exists', async () => {
    await expect(isSchoolSwitchEnabled(reading('notFound'))).resolves.toBe(true)
  })

  it('is disabled when the setting holds false', async () => {
    await expect(
      isSchoolSwitchEnabled(
        reading({ id: 's', name: 'school_switch_enabled', value: 'false', valueType: 'BOOLEAN' })
      )
    ).resolves.toBe(false)
  })

  it('is enabled when the setting holds true', async () => {
    await expect(
      isSchoolSwitchEnabled(
        reading({ id: 's', name: 'school_switch_enabled', value: 'true', valueType: 'BOOLEAN' })
      )
    ).resolves.toBe(true)
  })

  it('asks for the school switch setting by name', async () => {
    const getSetting = reading('notFound')

    await isSchoolSwitchEnabled(getSetting)

    expect(getSetting).toHaveBeenCalledWith({ name: 'school_switch_enabled' })
  })
})
