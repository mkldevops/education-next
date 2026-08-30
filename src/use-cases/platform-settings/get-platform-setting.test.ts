import { beforeEach, describe, expect, it } from 'vitest'
import { getPlatformSetting } from './get-platform-setting'

type PlatformSettingGw = Parameters<typeof getPlatformSetting>[1]

class PlatformSettingGatewaySpy {
  settingsByName: Record<string, { id: string; name: string; value: string; valueType: string }> = {
    school_switch_enabled: {
      id: 'setting-1',
      name: 'school_switch_enabled',
      value: 'false',
      valueType: 'BOOLEAN',
    },
  }

  async get(name: string) {
    return this.settingsByName[name] ?? null
  }

  async set() {
    return {} as never
  }
}

describe('getPlatformSetting', () => {
  let gateway: PlatformSettingGatewaySpy

  beforeEach(() => {
    gateway = new PlatformSettingGatewaySpy()
  })

  it('fails validation when the name is empty', async () => {
    const result = await getPlatformSetting({ name: '' }, gateway as unknown as PlatformSettingGw)

    expect(result).toBe('validationError')
  })

  it('fails validation when the name exceeds the column length', async () => {
    const result = await getPlatformSetting(
      { name: 'a'.repeat(251) },
      gateway as unknown as PlatformSettingGw
    )

    expect(result).toBe('validationError')
  })

  it('reports an absent setting', async () => {
    const result = await getPlatformSetting(
      { name: 'never_written' },
      gateway as unknown as PlatformSettingGw
    )

    expect(result).toBe('notFound')
  })

  it('returns the stored setting', async () => {
    const result = await getPlatformSetting(
      { name: 'school_switch_enabled' },
      gateway as unknown as PlatformSettingGw
    )

    expect(result).toMatchObject({ name: 'school_switch_enabled', value: 'false' })
  })
})
