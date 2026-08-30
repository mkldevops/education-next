import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setPlatformSetting } from './set-platform-setting'

type PlatformSettingGw = Parameters<typeof setPlatformSetting>[1]

const set = vi.fn(async (data: { name: string; value: string; valueType: string }) => ({
  id: 'setting-1',
  ...data,
}))

const gateway = { get: async () => null, set } as unknown as PlatformSettingGw

describe('setPlatformSetting', () => {
  beforeEach(() => {
    set.mockClear()
  })

  it('fails validation when the name is empty', async () => {
    const result = await setPlatformSetting(
      { name: '', value: 'true', valueType: 'BOOLEAN' },
      gateway
    )

    expect(result).toBe('validationError')
    expect(set).not.toHaveBeenCalled()
  })

  it('refuses a boolean setting whose value is not a boolean', async () => {
    const result = await setPlatformSetting(
      { name: 'school_switch_enabled', value: 'maybe', valueType: 'BOOLEAN' },
      gateway
    )

    expect(result).toBe('invalidSettingValue')
    expect(set).not.toHaveBeenCalled()
  })

  it('refuses a number setting whose value is not a number', async () => {
    const result = await setPlatformSetting(
      { name: 'quota', value: 'lots', valueType: 'NUMBER' },
      gateway
    )

    expect(result).toBe('invalidSettingValue')
    expect(set).not.toHaveBeenCalled()
  })

  it('writes a valid setting', async () => {
    const result = await setPlatformSetting(
      { name: 'school_switch_enabled', value: 'false', valueType: 'BOOLEAN' },
      gateway
    )

    expect(set).toHaveBeenCalledWith({
      name: 'school_switch_enabled',
      value: 'false',
      valueType: 'BOOLEAN',
    })
    expect(result).toMatchObject({ name: 'school_switch_enabled', value: 'false' })
  })
})
