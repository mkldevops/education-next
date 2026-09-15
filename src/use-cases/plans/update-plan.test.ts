import { beforeEach, describe, expect, it } from 'vitest'
import { updatePlan } from './update-plan'

type PlanGw = Parameters<typeof updatePlan>[1]
type ConfigGw = Parameters<typeof updatePlan>[2]

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
    return { id, amount: 100, ...(data as object) } as never
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

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

describe('updatePlan', () => {
  let gateway: PlanGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    gateway = new PlanGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  it('fails validation when id is invalid', async () => {
    // GIVEN
    const input = { schoolId, id: 'invalid-uuid', name: 'Updated Plan' }

    // WHEN
    const result = await updatePlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = { schoolId, id: '123e4567-e89b-12d3-a456-426614174000', name: '' }

    // WHEN
    const result = await updatePlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when amount is not positive', async () => {
    // GIVEN
    const input = { schoolId, id: '123e4567-e89b-12d3-a456-426614174000', amount: 0 }

    // WHEN
    const result = await updatePlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

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
    const result = await updatePlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

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
    const result = await updatePlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

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
    const result = await updatePlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

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
    await updatePlan(input, gateway as unknown as PlanGw, configGateway as unknown as ConfigGw)

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
    await updatePlan(input, gateway as unknown as PlanGw, configGateway as unknown as ConfigGw)

    // THEN
    expect(gateway.updatedSchoolId).toBe(schoolId)
    expect(gateway.updatedId).toBe(planId)
  })

  it('refuses to update a plan when payments are disabled', async () => {
    // GIVEN
    configGateway.configToReturn = { value: 'false' }
    const input = { schoolId, id: '123e4567-e89b-12d3-a456-426614174000', name: 'Updated Plan' }

    // WHEN
    const result = await updatePlan(
      input,
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    // THEN
    expect(result).toBe('paymentsDisabled')
    expect(gateway.updatedData).toBeNull()
  })
})
