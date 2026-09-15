import { describe, expect, it, vi } from 'vitest'
import type { configGateway } from '@/gateways/config-gateway'
import { isPaymentsEnabled } from './is-payments-enabled'

const reading = (value: string | null) =>
  ({
    get: vi.fn(async () => (value === null ? null : { name: 'payments_enabled', value })),
  }) as unknown as typeof configGateway

describe('isPaymentsEnabled', () => {
  it('is enabled when the school holds no setting, so an existing school keeps its payments', async () => {
    await expect(isPaymentsEnabled('school-1', reading(null))).resolves.toBe(true)
  })

  it('is disabled only on an explicit refusal', async () => {
    await expect(isPaymentsEnabled('school-1', reading('false'))).resolves.toBe(false)
    await expect(isPaymentsEnabled('school-1', reading('true'))).resolves.toBe(true)
  })

  it('keeps an unreadable value enabled rather than silently closing the feature', async () => {
    await expect(isPaymentsEnabled('school-1', reading('nope'))).resolves.toBe(true)
  })

  it('reads the setting scoped to the school it was asked about', async () => {
    const configGw = reading('false')

    await isPaymentsEnabled('school-2', configGw)

    expect(configGw.get).toHaveBeenCalledWith('school-2', 'payments_enabled')
  })
})
