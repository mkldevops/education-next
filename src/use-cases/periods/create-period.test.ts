import { beforeEach, describe, expect, it } from 'vitest'
import type { periodGateway } from '@/gateways/period-gateway'
import { createPeriod } from './create-period'

class PeriodGatewaySpy {
  createdSchoolId: string | null = null
  createdData: unknown = null
  overlapToReturn = false
  periodToReturn: unknown = null

  async create(schoolId: string, data: unknown) {
    this.createdSchoolId = schoolId
    this.createdData = data
    return (this.periodToReturn ?? { id: 'period-123', ...(data as object) }) as { id: string }
  }

  async update() {
    return {} as never
  }

  async findById() {
    return {} as never
  }

  async list() {
    return []
  }

  async checkOverlap() {
    return this.overlapToReturn
  }
}

function asGateway(gateway: PeriodGatewaySpy) {
  return gateway as unknown as typeof periodGateway
}

const schoolId = 'school-1'

describe('createPeriod', () => {
  let gateway: PeriodGatewaySpy

  beforeEach(() => {
    gateway = new PeriodGatewaySpy()
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = {
      schoolId,
      name: '',
      startAt: new Date('2026-03-01'),
      endAt: new Date('2026-06-30'),
    }

    // WHEN
    const result = await createPeriod(input, asGateway(gateway))

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when endAt is before startAt', async () => {
    // GIVEN
    const input = {
      schoolId,
      name: 'Q1',
      startAt: new Date('2026-06-30'),
      endAt: new Date('2026-03-01'),
    }

    // WHEN
    const result = await createPeriod(input, asGateway(gateway))

    // THEN
    expect(result).toBe('invalidDates')
  })

  it('fails validation when endAt equals startAt', async () => {
    // GIVEN
    const sameDate = new Date('2026-03-01')
    const input = {
      schoolId,
      name: 'Q1',
      startAt: sameDate,
      endAt: sameDate,
    }

    // WHEN
    const result = await createPeriod(input, asGateway(gateway))

    // THEN
    expect(result).toBe('invalidDates')
  })

  it('fails when period overlaps with existing', async () => {
    // GIVEN
    gateway.overlapToReturn = true
    const input = {
      schoolId,
      name: 'Q1',
      startAt: new Date('2026-03-01'),
      endAt: new Date('2026-06-30'),
    }

    // WHEN
    const result = await createPeriod(input, asGateway(gateway))

    // THEN
    expect(result).toBe('overlappingPeriod')
  })

  it('creates period with valid dates', async () => {
    // GIVEN
    const input = {
      schoolId,
      name: 'Q1 2026',
      startAt: new Date('2026-03-01'),
      endAt: new Date('2026-06-30'),
    }

    // WHEN
    const result = await createPeriod(input, asGateway(gateway))

    // THEN
    expect(result).toHaveProperty('id', 'period-123')
  })

  it('calls gateway with correct data', async () => {
    // GIVEN
    const startAt = new Date('2026-03-01')
    const endAt = new Date('2026-06-30')
    const input = {
      schoolId,
      name: 'Q1 2026',
      startAt,
      endAt,
    }

    // WHEN
    await createPeriod(input, asGateway(gateway))

    // THEN
    expect(gateway.createdSchoolId).toBe(schoolId)
    expect(gateway.createdData).toMatchObject({
      name: 'Q1 2026',
      startAt,
      endAt,
    })
  })
})
