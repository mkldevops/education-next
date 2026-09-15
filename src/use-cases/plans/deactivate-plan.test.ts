import { beforeEach, describe, expect, it } from 'vitest'
import type { planGateway } from '@/gateways/plan-gateway'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { deactivatePlan } from './deactivate-plan'

type ConfigGw = Parameters<typeof deactivatePlan>[2]

class PlanGatewaySpy {
  plansById: Record<string, { id: string; name: string }> = {}
  openEnrollments = 0
  deactivateCalls: Array<{ schoolId: string; id: string }> = []

  async findById(_schoolId: string, id: string) {
    return this.plansById[id] ?? null
  }

  async countOpenEnrollments() {
    return this.openEnrollments
  }

  async deactivate(schoolId: string, id: string) {
    this.deactivateCalls.push({ schoolId, id })
    return {} as never
  }
}

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

function asGateway(gateway: PlanGatewaySpy) {
  return gateway as unknown as typeof planGateway
}

function asConfigGateway(gateway: ConfigGatewaySpy) {
  return gateway as unknown as ConfigGw
}

const schoolId = 'school-1'
const planId = '123e4567-e89b-42d3-a456-426614174001'

describe('deactivatePlan', () => {
  let gateway: PlanGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    gateway = new PlanGatewaySpy()
    gateway.plansById = { [planId]: { id: planId, name: 'Forfait Basic (2026/2027)' } }
    configGateway = new ConfigGatewaySpy()
  })

  it('rejects an invalid id', async () => {
    const result = await deactivatePlan(
      { schoolId, id: 'nope' },
      asGateway(gateway),
      asConfigGateway(configGateway)
    )

    expect(result).toBe('validationError')
  })

  it('fails when the plan does not exist', async () => {
    const result = await deactivatePlan(
      { schoolId, id: '123e4567-e89b-42d3-a456-426614174099' },
      asGateway(gateway),
      asConfigGateway(configGateway)
    )

    expect(result).toBe('notFound')
  })

  it('refuses to archive a plan an open enrollment still uses', async () => {
    gateway.openEnrollments = 1

    const result = await deactivatePlan(
      { schoolId, id: planId },
      asGateway(gateway),
      asConfigGateway(configGateway)
    )

    expect(result).toBe('planInUse')
    expect(gateway.deactivateCalls).toEqual([])
  })

  it('archives a plan no open enrollment uses', async () => {
    const result = await deactivatePlan(
      { schoolId, id: planId },
      asGateway(gateway),
      asConfigGateway(configGateway)
    )

    expect(result).toBe('OK')
    expect(gateway.deactivateCalls).toEqual([{ schoolId, id: planId }])
  })

  it('refuses to archive a plan when payments are disabled', async () => {
    configGateway.configToReturn = { value: 'false' }

    const result = await deactivatePlan(
      { schoolId, id: planId },
      asGateway(gateway),
      asConfigGateway(configGateway)
    )

    expect(result).toBe('paymentsDisabled')
    expect(gateway.deactivateCalls).toEqual([])
  })

  it('refuses to archive the reserved unpriced plan even when payments are enabled', async () => {
    gateway.plansById[planId] = { id: planId, name: UNPRICED_PLAN_NAME }

    const result = await deactivatePlan(
      { schoolId, id: planId },
      asGateway(gateway),
      asConfigGateway(configGateway)
    )

    expect(result).toBe('unpricedPlan')
    expect(gateway.deactivateCalls).toEqual([])
  })
})
