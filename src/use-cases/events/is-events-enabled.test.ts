import { describe, expect, it, vi } from 'vitest'
import type { configGateway } from '@/gateways/config-gateway'
import { isEventsEnabled } from './is-events-enabled'

const reading = (value: string | null) =>
  ({
    get: vi.fn(async () => (value === null ? null : { name: 'events_enabled', value })),
  }) as unknown as typeof configGateway

describe('isEventsEnabled', () => {
  it('is disabled when the school holds no setting, matching the off-by-default flag', async () => {
    await expect(isEventsEnabled('school-1', reading(null))).resolves.toBe(false)
  })

  it('is enabled only on an explicit "true"', async () => {
    await expect(isEventsEnabled('school-1', reading('true'))).resolves.toBe(true)
    await expect(isEventsEnabled('school-1', reading('false'))).resolves.toBe(false)
  })

  it('stays disabled on an unreadable value rather than opening the feature by accident', async () => {
    await expect(isEventsEnabled('school-1', reading('nope'))).resolves.toBe(false)
  })

  it('reads the setting scoped to the school it was asked about', async () => {
    const configGw = reading('true')

    await isEventsEnabled('school-2', configGw)

    expect(configGw.get).toHaveBeenCalledWith('school-2', 'events_enabled')
  })
})
