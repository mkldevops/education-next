import { beforeEach, describe, expect, it } from 'vitest'
import type { planGateway } from '@/gateways/plan-gateway'
import { deactivatePlan } from './deactivate-plan'

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

function asGateway(gateway: PlanGatewaySpy) {
  return gateway as unknown as typeof planGateway
}

const schoolId = 'school-1'
const planId = '123e4567-e89b-42d3-a456-426614174001'

describe('deactivatePlan', () => {
  let gateway: PlanGatewaySpy

  beforeEach(() => {
    gateway = new PlanGatewaySpy()
    gateway.plansById = { [planId]: { id: planId, name: 'Forfait Basic (2026/2027)' } }
  })

  it('rejects an invalid id', async () => {
    expect(await deactivatePlan({ schoolId, id: 'nope' }, asGateway(gateway))).toBe(
      'validationError'
    )
  })

  it('fails when the plan does not exist', async () => {
    expect(
      await deactivatePlan(
        { schoolId, id: '123e4567-e89b-42d3-a456-426614174099' },
        asGateway(gateway)
      )
    ).toBe('notFound')
  })

  it('refuses to archive a plan an open enrollment still uses', async () => {
    gateway.openEnrollments = 1

    expect(await deactivatePlan({ schoolId, id: planId }, asGateway(gateway))).toBe('planInUse')
    expect(gateway.deactivateCalls).toEqual([])
  })

  it('archives a plan no open enrollment uses', async () => {
    expect(await deactivatePlan({ schoolId, id: planId }, asGateway(gateway))).toBe('OK')
    expect(gateway.deactivateCalls).toEqual([{ schoolId, id: planId }])
  })
})
