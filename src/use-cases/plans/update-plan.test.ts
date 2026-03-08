import { beforeEach, describe, expect, it } from 'vitest'
import { updatePlan } from './update-plan'

class PlanGatewaySpy {
  updatedId: string | null = null
  updatedData: unknown = null
  planToReturn: any = null

  async update(id: string, data: unknown) {
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
    const input = { id: 'invalid-uuid', name: 'Updated Plan' }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = { id: '123e4567-e89b-12d3-a456-426614174000', name: '' }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when amount is not positive', async () => {
    // GIVEN
    const input = { id: '123e4567-e89b-12d3-a456-426614174000', amount: 0 }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('updates plan name only', async () => {
    // GIVEN
    const input = {
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
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Premium Plus',
      amount: 299.99,
    }

    // WHEN
    const result = await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', '123e4567-e89b-12d3-a456-426614174000')
  })

  it('excludes id from update data sent to gateway', async () => {
    // GIVEN
    const input = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Updated',
    }

    // WHEN
    await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(gateway.updatedData).not.toHaveProperty('id')
  })

  it('sends correct id to gateway', async () => {
    // GIVEN
    const planId = '123e4567-e89b-12d3-a456-426614174000'
    const input = {
      id: planId,
      name: 'Updated Plan',
    }

    // WHEN
    await updatePlan(input, gateway as unknown as any)

    // THEN
    expect(gateway.updatedId).toBe(planId)
  })
})
