import { describe, expect, it, vi } from 'vitest'
import { isMcpEnabled } from './is-mcp-enabled'

type GetSetting = NonNullable<Parameters<typeof isMcpEnabled>[0]>

const reading = (result: unknown) => vi.fn(async () => result) as unknown as GetSetting

describe('isMcpEnabled', () => {
  it('is disabled when no setting row exists', async () => {
    await expect(isMcpEnabled(reading('notFound'))).resolves.toBe(false)
  })

  it('is disabled when the setting holds false', async () => {
    await expect(
      isMcpEnabled(reading({ id: 's', name: 'mcp_enabled', value: 'false', valueType: 'BOOLEAN' }))
    ).resolves.toBe(false)
  })

  it('is enabled when the setting holds true', async () => {
    await expect(
      isMcpEnabled(reading({ id: 's', name: 'mcp_enabled', value: 'true', valueType: 'BOOLEAN' }))
    ).resolves.toBe(true)
  })

  it('asks for the MCP setting by name', async () => {
    const getSetting = reading('notFound')

    await isMcpEnabled(getSetting)

    expect(getSetting).toHaveBeenCalledWith({ name: 'mcp_enabled' })
  })
})
