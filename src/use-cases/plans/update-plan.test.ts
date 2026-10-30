import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updatePlan } from './update-plan'

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi
    .fn()
    .mockResolvedValue({ currency: 'EUR', timeZone: 'Europe/Paris' }),
}))

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

  planToFind: {
    id: string
    name: string
    amount?: number
    pricing?: unknown
    paymentSchedule?: unknown
  } = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Tarif annuel',
  }

  async findById() {
    return this.planToFind as never
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

  // Renommer une formule ordinaire en formule réservée la retire de tous les catalogues et
  // de l'archivage — plus aucune ligne à cliquer — puis `ensureUnpriced` adopte son montant,
  // donc une inscription « sans tarif » naîtrait tarifée.
  it('refuses to rename an ordinary plan into the reserved one', async () => {
    const result = await updatePlan(
      { schoolId, id: '123e4567-e89b-12d3-a456-426614174000', name: '__unpriced__' },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('unpricedPlan')
    expect(gateway.updatedData).toBeNull()
  })

  it('refuses to touch the reserved plan itself, which would reprice it', async () => {
    gateway.planToFind = { id: '123e4567-e89b-12d3-a456-426614174111', name: '__unpriced__' }

    const result = await updatePlan(
      { schoolId, id: '123e4567-e89b-12d3-a456-426614174111', amount: 980 },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('unpricedPlan')
    expect(gateway.updatedData).toBeNull()
  })

  it('updates the stored annual total when the monthly price changes', async () => {
    const result = await updatePlan(
      {
        schoolId,
        id: gateway.planToFind.id,
        pricing: { mode: 'MONTHLY', amount: 45.5, months: 9 },
      },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toHaveProperty('id', gateway.planToFind.id)
    expect(gateway.updatedData).toEqual({
      amount: 409.5,
      pricing: { mode: 'MONTHLY', amount: 45.5, months: 9 },
    })
  })

  it('replaces monthly price metadata with annual pricing for an amount-only update', async () => {
    gateway.planToFind.pricing = { mode: 'MONTHLY', amount: 50, months: 10 }
    gateway.planToFind.amount = 500

    await updatePlan(
      { schoolId, id: gateway.planToFind.id, amount: 600 },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(gateway.updatedData).toEqual({ amount: 600, pricing: { mode: 'ANNUAL', amount: 600 } })
  })

  it('changes only the schedule when pricing is omitted', async () => {
    gateway.planToFind.pricing = { mode: 'MONTHLY', amount: 50, months: 10 }
    gateway.planToFind.amount = 500
    const paymentSchedule = {
      mode: 'INSTALLMENTS' as const,
      dates: [
        { month: 9, day: 15 },
        { month: 1, day: 15 },
      ],
    }

    await updatePlan(
      { schoolId, id: gateway.planToFind.id, paymentSchedule },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(gateway.updatedData).toEqual({ paymentSchedule })
    expect(gateway.updatedData).not.toHaveProperty('amount')
    expect(gateway.updatedData).not.toHaveProperty('pricing')
  })

  it('clears deadline tracking explicitly with NONE without changing the price', async () => {
    gateway.planToFind.paymentSchedule = { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 5 }

    await updatePlan(
      { schoolId, id: gateway.planToFind.id, paymentSchedule: { mode: 'NONE' } },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(gateway.updatedData).toEqual({ paymentSchedule: { mode: 'NONE' } })
  })

  it('rejects conflicting amount and pricing without updating the plan', async () => {
    const result = await updatePlan(
      {
        schoolId,
        id: gateway.planToFind.id,
        amount: 500,
        pricing: { mode: 'ANNUAL', amount: 600 },
      },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
    expect(gateway.updatedData).toBeNull()
  })

  it('rejects a sixth installment without updating the plan', async () => {
    const result = await updatePlan(
      {
        schoolId,
        id: gateway.planToFind.id,
        paymentSchedule: {
          mode: 'INSTALLMENTS',
          dates: [9, 10, 11, 12, 1, 2].map((month) => ({ month, day: 5 })),
        },
      },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
    expect(gateway.updatedData).toBeNull()
  })

  it('does not allow adding payment tracking to the reserved unpriced plan', async () => {
    gateway.planToFind.name = '__unpriced__'
    const result = await updatePlan(
      {
        schoolId,
        id: gateway.planToFind.id,
        paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 15 },
      },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('unpricedPlan')
    expect(gateway.updatedData).toBeNull()
  })

  it.each([
    { amount: 100.5 },
    { pricing: { mode: 'ANNUAL' as const, amount: 100.5 } },
    { pricing: { mode: 'MONTHLY' as const, amount: 10.05, months: 10 } },
    { pricing: { mode: 'MONTHLY' as const, amount: 10.5, months: 2 } },
  ])('rejects fractional KMF price updates %j', async (price) => {
    const settings = vi.fn().mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' })
    const result = await updatePlan(
      { schoolId, id: gateway.planToFind.id, ...price },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw,
      settings
    )

    expect(result).toBe('validationError')
    expect(gateway.updatedData).toBeNull()
    expect(settings).toHaveBeenCalledWith(schoolId)
  })

  it('accepts whole-unit KMF price updates', async () => {
    const result = await updatePlan(
      { schoolId, id: gateway.planToFind.id, amount: 100 },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw,
      async () => ({ currency: 'KMF', timeZone: 'Indian/Comoro' })
    )

    expect(result).toHaveProperty('id', gateway.planToFind.id)
    expect(gateway.updatedData).toEqual({ amount: 100, pricing: { mode: 'ANNUAL', amount: 100 } })
  })

  it('does not read currency settings when only the schedule or name changes', async () => {
    const settings = vi.fn().mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' })
    await updatePlan(
      {
        schoolId,
        id: gateway.planToFind.id,
        name: 'Renamed tuition',
        paymentSchedule: { mode: 'NONE' },
      },
      gateway as unknown as PlanGw,
      configGateway as unknown as ConfigGw,
      settings
    )

    expect(settings).not.toHaveBeenCalled()
    expect(gateway.updatedData).toEqual({
      name: 'Renamed tuition',
      paymentSchedule: { mode: 'NONE' },
    })
  })
})
