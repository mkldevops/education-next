import { beforeEach, describe, expect, it } from 'vitest'
import { updateClassPeriod } from './update-class-period'

class ClassPeriodGatewaySpy {
  classPeriodsByIdMap: Record<string, { id: string; name: string; capacity: number }> = {}
  enrolledCountToReturn = 0
  updatedId: string | null = null
  updatedData: unknown = null

  async findById(id: string) {
    return this.classPeriodsByIdMap[id] || null
  }

  async countEnrolled() {
    return this.enrolledCountToReturn
  }

  async update(id: string, data: unknown) {
    this.updatedId = id
    this.updatedData = data
    const existing = this.classPeriodsByIdMap[id] || {}
    return { ...existing, id, ...(data as object) } as unknown
  }

  async create() {
    return {} as never
  }

  async list() {
    return []
  }

  async findByLevelAndPeriod() {
    return null
  }
}

describe('updateClassPeriod', () => {
  let gateway: ClassPeriodGatewaySpy
  const classPeriodId1 = '123e4567-e89b-12d3-a456-426614174001'

  beforeEach(() => {
    gateway = new ClassPeriodGatewaySpy()
    gateway.classPeriodsByIdMap = {
      [classPeriodId1]: {
        id: classPeriodId1,
        name: 'Class A',
        capacity: 30,
      },
    }
  })

  it('fails validation when id is invalid', async () => {
    // GIVEN
    const input = { id: 'invalid-uuid', name: 'Updated Class' }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when class period not found', async () => {
    // GIVEN
    const input = { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Class B' }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when reducing capacity below enrolled count', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 25
    const input = {
      id: classPeriodId1,
      capacity: 20,
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown)

    // THEN
    expect(result).toBe('capacityBelowEnrolled')
  })

  it('updates class period name only', async () => {
    // GIVEN
    const input = {
      id: classPeriodId1,
      name: 'Updated Class A',
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })

  it('updates class period capacity when valid', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 20
    const input = {
      id: classPeriodId1,
      capacity: 25,
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })

  it('updates capacity when equal to enrolled count', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 25
    const input = {
      id: classPeriodId1,
      capacity: 25,
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })

  it('updates both name and capacity', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 15
    const input = {
      id: classPeriodId1,
      name: 'Class B',
      capacity: 28,
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })

  it('excludes id from update data sent to gateway', async () => {
    // GIVEN
    const input = {
      id: classPeriodId1,
      name: 'Updated Name',
    }

    // WHEN
    await updateClassPeriod(input, gateway as unknown)

    // THEN
    expect(gateway.updatedData).not.toHaveProperty('id')
  })

  it('does not check capacity when only name is updated', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 100
    const input = {
      id: classPeriodId1,
      name: 'New Name',
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })
})
