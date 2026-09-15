import { beforeEach, describe, expect, it } from 'vitest'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { createPlan } from './create-plan'

type PlanGw = Parameters<typeof createPlan>[1]
type ConfigGw = Parameters<typeof createPlan>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'

class PlanGatewaySpy {
  createdSchoolId: string | null = null
  createdData: unknown = null
  planToReturn: unknown = null

  async create(createSchoolId: string, data: unknown) {
    this.createdSchoolId = createSchoolId
    this.createdData = data
    return (this.planToReturn || { id: 'plan-123', ...(data as object) }) as never
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

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

describe('createPlan', () => {
  let gateway: PlanGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    gateway = new PlanGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = { schoolId, name: '', amount: 100 }

    // WHEN
    const result = await createPlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when name exceeds max length', async () => {
    // GIVEN
    const input = { schoolId, name: 'a'.repeat(51), amount: 100 }

    // WHEN
    const result = await createPlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when amount is not positive', async () => {
    // GIVEN
    const input = { schoolId, name: 'Basic Plan', amount: 0 }

    // WHEN
    const result = await createPlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when amount is negative', async () => {
    // GIVEN
    const input = { schoolId, name: 'Basic Plan', amount: -50 }

    // WHEN
    const result = await createPlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toBe('validationError')
  })

  it('creates plan with valid data', async () => {
    // GIVEN
    const input = { schoolId, name: 'Basic Plan', amount: 99.99 }

    // WHEN
    const result = await createPlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toHaveProperty('id', 'plan-123')
  })

  it('calls gateway with correct data', async () => {
    // GIVEN
    const input = { schoolId, name: 'Premium Plan', amount: 199.99 }

    // WHEN
    await createPlan(input, gateway as unknown as PlanGw, configGateway as unknown as ConfigGw)

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
    const result = await createPlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toHaveProperty('id', 'plan-123')
  })

  it('refuses to create a plan when payments are disabled', async () => {
    // GIVEN
    configGateway.configToReturn = { value: 'false' }
    const input = { schoolId, name: 'Basic Plan', amount: 100 }

    // WHEN
    const result = await createPlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toBe('paymentsDisabled')
    expect(gateway.createdData).toBeNull()
  })

  it('refuses to create a plan named like the reserved unpriced plan', async () => {
    // GIVEN
    const input = { schoolId, name: UNPRICED_PLAN_NAME, amount: 100 }

    // WHEN
    const result = await createPlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toBe('unpricedPlan')
    expect(gateway.createdData).toBeNull()
  })
})
