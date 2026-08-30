import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePlatformAdminMock = vi.fn()
const setPlatformSettingMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('./auth-helper', () => ({ requirePlatformAdmin: requirePlatformAdminMock }))
vi.mock('@/use-cases/platform-settings/set-platform-setting', () => ({
  setPlatformSetting: setPlatformSettingMock,
}))

const { setSchoolSwitchEnabledAction } = await import('./platform-settings-actions')

beforeEach(() => {
  vi.clearAllMocks()
  requirePlatformAdminMock.mockResolvedValue({ userId: 'super-1' })
  setPlatformSettingMock.mockResolvedValue({
    id: 'setting-1',
    name: 'school_switch_enabled',
    value: 'false',
    valueType: 'BOOLEAN',
  })
})

describe('setSchoolSwitchEnabledAction', () => {
  it('opens on the platform guard before writing', async () => {
    requirePlatformAdminMock.mockRejectedValue(new Error('notFound'))

    await expect(setSchoolSwitchEnabledAction(false)).rejects.toThrow('notFound')
    expect(setPlatformSettingMock).not.toHaveBeenCalled()
  })

  it('writes the flag as a boolean setting and replays the layout', async () => {
    expect(await setSchoolSwitchEnabledAction(false)).toBe('OK')
    expect(setPlatformSettingMock).toHaveBeenCalledWith({
      name: 'school_switch_enabled',
      value: 'false',
      valueType: 'BOOLEAN',
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })

  it('re-enables the switch', async () => {
    await setSchoolSwitchEnabledAction(true)

    expect(setPlatformSettingMock).toHaveBeenCalledWith({
      name: 'school_switch_enabled',
      value: 'true',
      valueType: 'BOOLEAN',
    })
  })

  it('forwards a use-case refusal without revalidating', async () => {
    setPlatformSettingMock.mockResolvedValue('invalidSettingValue')

    expect(await setSchoolSwitchEnabledAction(true)).toBe('invalidSettingValue')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
