import { beforeEach, describe, expect, it } from 'vitest'
import type { classPeriodGateway } from '@/gateways/class-period-gateway'
import { deactivateClassPeriod } from './deactivate-class-period'

type Gateway = typeof classPeriodGateway

class ClassPeriodGatewaySpy {
  result: Awaited<ReturnType<Gateway['deactivate']>> = 'OK'
  calls: Array<{ schoolId: string; id: string }> = []

  async deactivate(schoolId: string, id: string) {
    this.calls.push({ schoolId, id })
    return this.result
  }
}

const schoolId = 'school-1'
const classPeriodId = '123e4567-e89b-12d3-a456-426614174001'

describe('deactivateClassPeriod', () => {
  let gateway: ClassPeriodGatewaySpy

  beforeEach(() => {
    gateway = new ClassPeriodGatewaySpy()
  })

  it('rejects an invalid class id', async () => {
    expect(
      await deactivateClassPeriod({ schoolId, id: 'invalid' }, gateway as unknown as Gateway)
    ).toBe('validationError')
    expect(gateway.calls).toEqual([])
  })

  it.each(['notFound', 'classInUse'] as const)('returns the gateway refusal %s', async (result) => {
    gateway.result = result

    expect(
      await deactivateClassPeriod({ schoolId, id: classPeriodId }, gateway as unknown as Gateway)
    ).toBe(result)
    expect(gateway.calls).toEqual([{ schoolId, id: classPeriodId }])
  })

  it('archives an unused class', async () => {
    expect(
      await deactivateClassPeriod({ schoolId, id: classPeriodId }, gateway as unknown as Gateway)
    ).toBe('OK')
    expect(gateway.calls).toEqual([{ schoolId, id: classPeriodId }])
  })
})
