import { beforeEach, describe, expect, it } from 'vitest'
import { createPlan } from './create-plan'

const schoolId = '00000000-0000-0000-0000-000000000001'

class PlanGatewaySpy {
  createdSchoolId: string | null = null
  createdData: unknown = null
  planToReturn: unknown = null

  async create(createSchoolId: string, data: unknown) {
    this.createdSchoolId = createSchoolId
    this.createdData = data
    return (this.planToReturn || { id: 'plan-123', ...(data as object) }) as unknown as any
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
}

describe('createPlan', () => {
  let gateway: PlanGatewaySpy

  beforeEach(() => {
    gateway = new PlanGatewaySpy()
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = { schoolId, name: '', amount: 100 }

    // WHEN
    const result = await createPlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when name exceeds max length', async () => {
    // GIVEN
    const input = { schoolId, name: 'a'.repeat(51), amount: 100 }

    // WHEN
    const result = await createPlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when amount is not positive', async () => {
    // GIVEN
    const input = { schoolId, name: 'Basic Plan', amount: 0 }

    // WHEN
    const result = await createPlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when amount is negative', async () => {
    // GIVEN
    const input = { schoolId, name: 'Basic Plan', amount: -50 }

    // WHEN
    const result = await createPlan(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('creates plan with valid data', async () => {
    // GIVEN
    const input = { schoolId, name: 'Basic Plan', amount: 99.99 }

    // WHEN
    const result = await createPlan(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', 'plan-123')
  })

  it('calls gateway with correct data', async () => {
    // GIVEN
    const input = { schoolId, name: 'Premium Plan', amount: 199.99 }

    // WHEN
    await createPlan(input, gateway as unknown as any)

    // THEN
    expect(gateway.createdSchoolId).toBe(schoolId)
    expect(gateway.createdData).toMatchObject({
      name: 'Premium Plan',
      amount: 199.99,
    })
  })

  it('accepts minimum valid amount', async () => {
    // GIVEN
    const input = { schoolId, name: 'Minimal Plan', amount: 0.01 }

    // WHEN
    const result = await createPlan(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', 'plan-123')
  })
})
