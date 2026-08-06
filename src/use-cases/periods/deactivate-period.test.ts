import { beforeEach, describe, expect, it } from 'vitest'
import { deactivatePeriod } from './deactivate-period'

class PeriodGatewaySpy {
  periodsByIdMap: Record<string, { id: string; name: string }> = {}
  classPeriodCount = 0
  deactivateCalls: string[] = []

  async findById(id: string) {
    return this.periodsByIdMap[id] || null
  }

  async countClassPeriods() {
    return this.classPeriodCount
  }

  async deactivate(id: string) {
    this.deactivateCalls.push(id)
    return {} as never
  }
}

const periodId = '123e4567-e89b-12d3-a456-426614174001'

describe('deactivatePeriod', () => {
  let gateway: PeriodGatewaySpy

  beforeEach(() => {
    gateway = new PeriodGatewaySpy()
    gateway.periodsByIdMap = { [periodId]: { id: periodId, name: '2025-2026' } }
  })

  it('rejects an invalid id', async () => {
    expect(await deactivatePeriod({ id: 'nope' }, gateway as never)).toBe('validationError')
  })

  it('fails when the period does not exist', async () => {
    expect(
      await deactivatePeriod({ id: '123e4567-e89b-12d3-a456-426614174099' }, gateway as never)
    ).toBe('notFound')
  })

  it('refuses to deactivate a period still used by classes', async () => {
    gateway.classPeriodCount = 2

    expect(await deactivatePeriod({ id: periodId }, gateway as never)).toBe('periodInUse')
    expect(gateway.deactivateCalls).toEqual([])
  })

  it('deactivates an unused period', async () => {
    expect(await deactivatePeriod({ id: periodId }, gateway as never)).toBe('OK')
    expect(gateway.deactivateCalls).toEqual([periodId])
  })
})
