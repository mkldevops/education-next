import { beforeEach, describe, expect, it } from 'vitest'
import { updatePlan } from './update-plan'

const schoolId = '00000000-0000-0000-0000-000000000001'

class PlanGatewaySpy {
  updatedSchoolId: string | null = null
  updatedId: string | null = null
  updatedData: unknown = null
  planToReturn: unknown = null

  async update(updateSchoolId: string, id: string, data: unknown) {
    this.updatedSchoolId = updateSchoolId
    this.updatedId = id
    this.updatedData = data
    return { id, amount: 100, ...(data as object) } as unknown as any
  }

  async create() {
    return {} as never
  }

  async findById() {
    return {} as never
  }

  async list() {
    return []
  }
}

describe('updatePlan', () => {
  let gateway: PlanGatewaySpy

  beforeEach(() => {
    gateway = new PlanGatewaySpy()
  })

  it('fails validation when id is invalid', async () => {
    // GIVEN
    const input = { schoolId, id: 'invalid-uuid', name: 'Updated Plan' }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = { schoolId, id: '123e4567-e89b-12d3-a456-426614174000', name: '' }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when amount is not positive', async () => {
    // GIVEN
    const input = { schoolId, id: '123e4567-e89b-12d3-a456-426614174000', amount: 0 }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('updates plan name only', async () => {
    // GIVEN
    const input = {
      schoolId,
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Updated Plan Name',
    }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', '123e4567-e89b-12d3-a456-426614174000')
  })

  it('updates plan amount only', async () => {
    // GIVEN
    const input = {
      schoolId,
      id: '123e4567-e89b-12d3-a456-426614174000',
      amount: 249.99,
    }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', '123e4567-e89b-12d3-a456-426614174000')
  })

  it('updates plan with both name and amount', async () => {
    // GIVEN
    const input = {
      schoolId,
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Premium Plus',
      amount: 299.99,
    }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', '123e4567-e89b-12d3-a456-426614174000')
  })

  it('excludes id and schoolId from update data sent to gateway', async () => {
    // GIVEN
    const input = {
      schoolId,
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Updated',
    }

    // WHEN
    await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(gateway.updatedData).not.toHaveProperty('id')
    expect(gateway.updatedData).not.toHaveProperty('schoolId')
  })

  it('sends correct schoolId and id to gateway', async () => {
    // GIVEN
    const planId = '123e4567-e89b-12d3-a456-426614174000'
    const input = {
      schoolId,
      id: planId,
      name: 'Updated Plan',
    }

    // WHEN
    await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(gateway.updatedSchoolId).toBe(schoolId)
    expect(gateway.updatedId).toBe(planId)
  })
})
