import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { createPlan } from './create-plan'

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi
    .fn()
    .mockResolvedValue({ currency: 'EUR', timeZone: 'Europe/Paris' }),
}))

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

  it('stores the annual total and monthly input basis together', async () => {
    const result = await createPlan(
      {
        schoolId,
        name: 'Monthly tuition',
        pricing: { mode: 'MONTHLY', amount: 99.99, months: 10 },
        paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 15 },
      },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toHaveProperty('id', 'plan-123')
    expect(gateway.createdData).toEqual({
      name: 'Monthly tuition',
      amount: 999.9,
      pricing: { mode: 'MONTHLY', amount: 99.99, months: 10 },
      paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 15 },
    })
  })

  it('stores an annual input with quarterly tracking independently of its pricing basis', async () => {
    await createPlan(
      {
        schoolId,
        name: 'Annual tuition',
        pricing: { mode: 'ANNUAL', amount: 1200 },
        paymentSchedule: { mode: 'QUARTERLY', firstMonth: 10, count: 3, dueDay: 31 },
      },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(gateway.createdData).toEqual({
      name: 'Annual tuition',
      amount: 1200,
      pricing: { mode: 'ANNUAL', amount: 1200 },
      paymentSchedule: { mode: 'QUARTERLY', firstMonth: 10, count: 3, dueDay: 31 },
    })
  })

  it('rejects an amount that conflicts with the total from monthly pricing', async () => {
    const result = await createPlan(
      {
        schoolId,
        name: 'Conflicting tuition',
        amount: 100,
        pricing: { mode: 'MONTHLY', amount: 100, months: 10 },
      },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
    expect(gateway.createdData).toBeNull()
  })

  it('rejects more than five custom installment dates', async () => {
    const result = await createPlan(
      {
        schoolId,
        name: 'Too many installments',
        amount: 600,
        paymentSchedule: {
          mode: 'INSTALLMENTS',
          dates: [9, 10, 11, 12, 1, 2].map((month) => ({ month, day: 5 })),
        },
      },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
    expect(gateway.createdData).toBeNull()
  })

  it.each([
    { amount: 0, months: 10 },
    { amount: -10, months: 10 },
    { amount: 10.001, months: 10 },
    { amount: 10, months: 0 },
    { amount: 10, months: 13 },
    { amount: 10, months: 1.5 },
    { amount: 10_000_000, months: 12 },
  ])('rejects invalid monthly pricing %j before persistence', async ({ amount, months }) => {
    const result = await createPlan(
      { schoolId, name: 'Invalid tuition', pricing: { mode: 'MONTHLY', amount, months } },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
    expect(gateway.createdData).toBeNull()
  })

  it('protects the reserved plan name when the price uses the monthly input', async () => {
    const result = await createPlan(
      { schoolId, name: UNPRICED_PLAN_NAME, pricing: { mode: 'MONTHLY', amount: 10, months: 10 } },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('unpricedPlan')
    expect(gateway.createdData).toBeNull()
  })

  it.each([
    { amount: 100.5 },
    { pricing: { mode: 'ANNUAL' as const, amount: 100.5 } },
    { pricing: { mode: 'MONTHLY' as const, amount: 10.05, months: 10 } },
    { pricing: { mode: 'MONTHLY' as const, amount: 10.5, months: 2 } },
  ])('rejects fractional KMF pricing %j', async (price) => {
    const settings = vi.fn().mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' })
    const result = await createPlan(
      { schoolId, name: 'Tuition', ...price },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw,
      settings
    )

    expect(result).toBe('validationError')
    expect(gateway.createdData).toBeNull()
    expect(settings).toHaveBeenCalledWith(schoolId)
  })

  it('accepts whole-unit KMF pricing', async () => {
    const result = await createPlan(
      { schoolId, name: 'Tuition', pricing: { mode: 'MONTHLY', amount: 100, months: 10 } },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw,
      async () => ({ currency: 'KMF', timeZone: 'Indian/Comoro' })
    )

    expect(result).toHaveProperty('id', 'plan-123')
    expect(gateway.createdData).toMatchObject({ amount: 1000 })
  })
})
