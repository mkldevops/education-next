import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePlatformAdminMock = vi.fn()
const setPlatformSettingMock = vi.fn()
const setOpenRouterApiKeyMock = vi.fn()
const deleteOpenRouterApiKeyMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('./auth-helper', () => ({ requirePlatformAdmin: requirePlatformAdminMock }))
vi.mock('@/use-cases/platform-settings/set-platform-setting', () => ({
  setPlatformSetting: setPlatformSettingMock,
}))
vi.mock('@/use-cases/platform-settings/openrouter-api-key', () => ({
  setOpenRouterApiKey: setOpenRouterApiKeyMock,
  deleteOpenRouterApiKey: deleteOpenRouterApiKeyMock,
}))

const {
  deleteOpenRouterApiKeyAction,
  setAiAssistantEnabledAction,
  setOpenRouterApiKeyAction,
  setGoogleSignInEnabledAction,
  setMcpEnabledAction,
  setPasskeySignInEnabledAction,
  setSchoolSwitchEnabledAction,
} = await import('./platform-settings-actions')

beforeEach(() => {
  vi.clearAllMocks()
  requirePlatformAdminMock.mockResolvedValue({ userId: 'super-1' })
  setOpenRouterApiKeyMock.mockResolvedValue('OK')
  deleteOpenRouterApiKeyMock.mockResolvedValue('OK')
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

describe('sign-in method actions', () => {
  it('opens on the platform guard before writing', async () => {
    requirePlatformAdminMock.mockRejectedValue(new Error('notFound'))

    await expect(setGoogleSignInEnabledAction(false)).rejects.toThrow('notFound')
    await expect(setPasskeySignInEnabledAction(false)).rejects.toThrow('notFound')
    expect(setPlatformSettingMock).not.toHaveBeenCalled()
  })

  it('writes each method under its own setting name', async () => {
    await setGoogleSignInEnabledAction(false)
    expect(setPlatformSettingMock).toHaveBeenCalledWith({
      name: 'google_sign_in_enabled',
      value: 'false',
      valueType: 'BOOLEAN',
    })

    await setPasskeySignInEnabledAction(true)
    expect(setPlatformSettingMock).toHaveBeenCalledWith({
      name: 'passkey_sign_in_enabled',
      value: 'true',
      valueType: 'BOOLEAN',
    })
  })

  it('forwards a use-case refusal without revalidating', async () => {
    setPlatformSettingMock.mockResolvedValue('invalidSettingValue')

    expect(await setGoogleSignInEnabledAction(true)).toBe('invalidSettingValue')
    expect(await setPasskeySignInEnabledAction(true)).toBe('invalidSettingValue')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('setMcpEnabledAction', () => {
  it('opens on the platform guard before writing', async () => {
    requirePlatformAdminMock.mockRejectedValue(new Error('notFound'))

    await expect(setMcpEnabledAction(true)).rejects.toThrow('notFound')
    expect(setPlatformSettingMock).not.toHaveBeenCalled()
  })

  it('writes the MCP flag under its own setting name', async () => {
    expect(await setMcpEnabledAction(true)).toBe('OK')
    expect(setPlatformSettingMock).toHaveBeenCalledWith({
      name: 'mcp_enabled',
      value: 'true',
      valueType: 'BOOLEAN',
    })
  })
})

describe('setAiAssistantEnabledAction', () => {
  it('opens on the platform guard before writing', async () => {
    requirePlatformAdminMock.mockRejectedValue(new Error('notFound'))

    await expect(setAiAssistantEnabledAction(true)).rejects.toThrow('notFound')
    expect(setPlatformSettingMock).not.toHaveBeenCalled()
  })

  it('writes the assistant flag under its own setting name', async () => {
    expect(await setAiAssistantEnabledAction(true)).toBe('OK')
    expect(setPlatformSettingMock).toHaveBeenCalledWith({
      name: 'ai_assistant_enabled',
      value: 'true',
      valueType: 'BOOLEAN',
    })
  })
})

describe('OpenRouter key actions', () => {
  it('open on the platform guard before touching the key', async () => {
    requirePlatformAdminMock.mockRejectedValue(new Error('notFound'))

    await expect(setOpenRouterApiKeyAction('test-openrouter-key-placeholder')).rejects.toThrow(
      'notFound'
    )
    await expect(deleteOpenRouterApiKeyAction()).rejects.toThrow('notFound')
    expect(setOpenRouterApiKeyMock).not.toHaveBeenCalled()
    expect(deleteOpenRouterApiKeyMock).not.toHaveBeenCalled()
  })

  it('stores the key through the use case and never echoes it', async () => {
    expect(await setOpenRouterApiKeyAction('test-openrouter-key-placeholder')).toBe('OK')
    expect(setOpenRouterApiKeyMock).toHaveBeenCalledWith('test-openrouter-key-placeholder')
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })

  it('forwards a use-case refusal without revalidating', async () => {
    setOpenRouterApiKeyMock.mockResolvedValue('secretStorageNotConfigured')

    expect(await setOpenRouterApiKeyAction('test-openrouter-key-placeholder')).toBe(
      'secretStorageNotConfigured'
    )
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('deletes the key and replays the layout', async () => {
    expect(await deleteOpenRouterApiKeyAction()).toBe('OK')
    expect(deleteOpenRouterApiKeyMock).toHaveBeenCalled()
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })
})
