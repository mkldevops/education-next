import { describe, expect, it, vi } from 'vitest'
import { isAiAssistantEnabled } from './is-ai-assistant-enabled'

type GetSetting = NonNullable<Parameters<typeof isAiAssistantEnabled>[0]>

const reading = (result: unknown) => vi.fn(async () => result) as unknown as GetSetting
const row = (value: string) => ({
  id: 's',
  name: 'ai_assistant_enabled',
  value,
  valueType: 'BOOLEAN',
})

describe('isAiAssistantEnabled', () => {
  it('is disabled when no setting row exists', async () => {
    await expect(isAiAssistantEnabled(reading('notFound'))).resolves.toBe(false)
  })

  it('is disabled when the setting holds false', async () => {
    await expect(isAiAssistantEnabled(reading(row('false')))).resolves.toBe(false)
  })

  it('is enabled when the setting holds true', async () => {
    await expect(isAiAssistantEnabled(reading(row('true')))).resolves.toBe(true)
  })

  it('asks for the assistant setting by name', async () => {
    const getSetting = reading('notFound')

    await isAiAssistantEnabled(getSetting)

    expect(getSetting).toHaveBeenCalledWith({ name: 'ai_assistant_enabled' })
  })
})
