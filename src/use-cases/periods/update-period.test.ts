import { beforeEach, describe, expect, it } from 'vitest'
import { updatePeriod } from './update-period'

class PeriodGatewaySpy {
  periodsByIdMap: Record<string, { id: string; name: string; startAt: Date; endAt: Date }> = {}
  overlapToReturn = false
  updatedId: string | null = null
  updatedData: unknown = null

  async findById(id: string) {
    return this.periodsByIdMap[id] || null
  }

  async update(id: string, data: unknown) {
    this.updatedId = id
    this.updatedData = data
    return { id, ...this.periodsByIdMap[id], ...data }
  }

  async list() {
    return []
  }

  async checkOverlap() {
    return this.overlapToReturn
  }

  async create() {
    return {} as never
  }
}

describe('updatePeriod', () => {
  let gateway: PeriodGatewaySpy

  beforeEach(() => {
    gateway = new PeriodGatewaySpy()
    gateway.periodsByIdMap = {
      'period-1': {
        id: 'period-1',
        name: 'Q1',
        startAt: new Date('2026-03-01'),
        endAt: new Date('2026-06-30'),
      },
    }
  })

  it('fails validation when id is invalid', async () => {
    // GIVEN
    const input = { id: 'invalid-uuid' }

    // WHEN
    const result = await updatePeriod(input, gateway)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when period not found', async () => {
    // GIVEN
    const input = { id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    const result = await updatePeriod(input, gateway)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when new endAt is before startAt', async () => {
    // GIVEN
    const input = {
      id: 'period-1',
      endAt: new Date('2026-02-01'),
    }

    // WHEN
    const result = await updatePeriod(input, gateway)

    // THEN
    expect(result).toBe('invalidDates')
  })

  it('fails when new startAt is after endAt', async () => {
    // GIVEN
    const input = {
      id: 'period-1',
      startAt: new Date('2026-07-01'),
    }

    // WHEN
    const result = await updatePeriod(input, gateway)

    // THEN
    expect(result).toBe('invalidDates')
  })

  it('fails when updated period would overlap', async () => {
    // GIVEN
    gateway.overlapToReturn = true
    const input = {
      id: 'period-1',
      startAt: new Date('2026-04-01'),
    }

    // WHEN
    const result = await updatePeriod(input, gateway)

    // THEN
    expect(result).toBe('overlappingPeriod')
  })

  it('updates period name only', async () => {
    // GIVEN
    const input = {
      id: 'period-1',
      name: 'Q1 2026',
    }

    // WHEN
    const result = await updatePeriod(input, gateway)

    // THEN
    expect(result).toHaveProperty('id', 'period-1')
  })

  it('updates period dates only', async () => {
    // GIVEN
    const input = {
      id: 'period-1',
      startAt: new Date('2026-03-15'),
      endAt: new Date('2026-06-15'),
    }

    // WHEN
    const result = await updatePeriod(input, gateway)

    // THEN
    expect(result).toHaveProperty('id', 'period-1')
  })

  it('updates period with multiple fields', async () => {
    // GIVEN
    const input = {
      id: 'period-1',
      name: 'Updated Q1',
      startAt: new Date('2026-03-15'),
    }

    // WHEN
    const result = await updatePeriod(input, gateway)

    // THEN
    expect(result).toHaveProperty('id', 'period-1')
  })

  it('calls gateway with correct data excluding id', async () => {
    // GIVEN
    const input = {
      id: 'period-1',
      name: 'Q1 Updated',
      startAt: new Date('2026-03-10'),
    }

    // WHEN
    await updatePeriod(input, gateway)

    // THEN
    expect(gateway.updatedData).toMatchObject({
      name: 'Q1 Updated',
      startAt: new Date('2026-03-10'),
    })
    expect(gateway.updatedData).not.toHaveProperty('id')
  })

  it('does not validate dates when only name is updated', async () => {
    // GIVEN
    const input = {
      id: 'period-1',
      name: 'New Name',
    }

    // WHEN
    const result = await updatePeriod(input, gateway)

    // THEN
    expect(result).toHaveProperty('id', 'period-1')
  })
})
