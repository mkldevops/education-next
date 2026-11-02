import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: async () => ({ currency: 'KMF', timeZone: 'Indian/Comoro' }),
}))

const { billChildcareMonth } = await import('./bill-childcare-month')
const { cancelChildcareCharge } = await import('./cancel-childcare-charge')
const { removeChildcareSubscription } = await import('./remove-childcare-subscription')
const { saveChildcareSubscription } = await import('./save-childcare-subscription')

type Gateway = Parameters<typeof billChildcareMonth>[1]
type ConfigGateway = Parameters<typeof billChildcareMonth>[2]

const schoolId = 'school-a'
const studentId = '7f9c2b6e-1d3a-4c5b-8e9f-0a1b2c3d4e5f'
const chargeId = '2a7d6f10-4c3b-4e8a-9b1c-6d5e4f3a2b1c'
const tx = { tx: true }

const subscription = {
  id: 'sub-1',
  monthlyAmount: 6000,
  startMonth: '2026-10',
  endMonth: null,
}

function fakeGateway() {
  return {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    studentExists: vi.fn().mockResolvedValue(true),
    lockStudentSubscription: vi.fn().mockResolvedValue(null),
    listLiveMonths: vi.fn().mockResolvedValue([]),
    upsertSubscription: vi.fn(),
    hasBillingHistory: vi.fn().mockResolvedValue(false),
    deleteSubscription: vi.fn(),
    lockBillableSubscriptions: vi.fn().mockResolvedValue([subscription]),
    listMonthCharges: vi.fn().mockResolvedValue([]),
    createCharges: vi.fn(),
    reviveCharge: vi.fn(),
    lockCharges: vi.fn().mockResolvedValue([{ id: chargeId, cancelled: false, paid: 0 }]),
    cancelCharge: vi.fn(),
  }
}

let gateway: ReturnType<typeof fakeGateway>
const enabled = {
  get: vi.fn().mockResolvedValue({ value: 'true' }),
} as unknown as ConfigGateway
const disabled = {
  get: vi.fn().mockResolvedValue({ value: 'false' }),
} as unknown as ConfigGateway
const asGateway = () => gateway as unknown as Gateway

beforeEach(() => {
  gateway = fakeGateway()
})

describe('saveChildcareSubscription', () => {
  const input = {
    schoolId,
    studentId,
    monthlyAmount: 3000,
    startMonth: '2026-11',
    endMonth: null,
  }
  const run = (over = {}, config = enabled) =>
    saveChildcareSubscription({ ...input, ...over }, asGateway(), config)

  it('stores the rate of the child without any meal account', async () => {
    expect(await run()).toBe('OK')
    expect(gateway.upsertSubscription).toHaveBeenCalledWith(tx, schoolId, {
      studentId,
      monthlyAmount: 3000,
      startMonth: '2026-11',
      endMonth: null,
    })
  })

  it('refuses a student outside the school', async () => {
    gateway.studentExists.mockResolvedValue(false)

    expect(await run()).toBe('notFound')
    expect(gateway.studentExists).toHaveBeenCalledWith(tx, schoolId, studentId)
    expect(gateway.upsertSubscription).not.toHaveBeenCalled()
  })

  it('refuses a missing or malformed start month', async () => {
    expect(await run({ startMonth: '' })).toBe('validationError')
    expect(await run({ startMonth: '2026-11-01' })).toBe('validationError')
  })

  it('refuses an end before the start', async () => {
    expect(await run({ endMonth: '2026-10' })).toBe('invalidPeriod')
  })

  it('refuses a fraction of a Comorian franc', async () => {
    expect(await run({ monthlyAmount: 3000.5 })).toBe('validationError')
  })

  it('refuses a period excluding a billed month', async () => {
    gateway.lockStudentSubscription.mockResolvedValue('sub-1')
    gateway.listLiveMonths.mockResolvedValue(['2026-10'])

    expect(await run()).toBe('chargesOutsideRange')
    expect(gateway.upsertSubscription).not.toHaveBeenCalled()
  })

  it('stays closed when the feature is off', async () => {
    expect(await run({}, disabled)).toBe('mealsDisabled')
    expect(gateway.transaction).not.toHaveBeenCalled()
  })
})

describe('billChildcareMonth', () => {
  const now = new Date('2026-11-15T08:00:00.000Z')
  const run = (month = '2026-11') =>
    billChildcareMonth({ schoolId, recordedById: 'admin', month }, asGateway(), enabled, now)

  it('creates the month at the frozen rate', async () => {
    expect(await run()).toEqual({ billed: 1, alreadyBilled: 0, outsideRange: 0 })
    expect(gateway.createCharges).toHaveBeenCalledWith(tx, schoolId, '2026-11', 'admin', [
      { subscriptionId: 'sub-1', amount: 6000 },
    ])
  })

  it('charges nothing twice on a replay', async () => {
    gateway.listMonthCharges.mockResolvedValue([
      { id: chargeId, subscriptionId: 'sub-1', cancelledAt: null },
    ])

    expect(await run()).toEqual({ billed: 0, alreadyBilled: 1, outsideRange: 0 })
    expect(gateway.createCharges).not.toHaveBeenCalled()
    expect(gateway.reviveCharge).not.toHaveBeenCalled()
  })

  it('restores a cancelled month', async () => {
    gateway.listMonthCharges.mockResolvedValue([
      { id: chargeId, subscriptionId: 'sub-1', cancelledAt: new Date() },
    ])

    expect(await run()).toEqual({ billed: 1, alreadyBilled: 0, outsideRange: 0 })
    expect(gateway.reviveCharge).toHaveBeenCalledWith(tx, schoolId, chargeId, 'admin', 6000)
  })

  it('refuses a future month', async () => {
    expect(await run('2026-12')).toBe('futureMonth')
    expect(gateway.transaction).not.toHaveBeenCalled()
  })
})

describe('cancelChildcareCharge', () => {
  const run = () =>
    cancelChildcareCharge(
      { schoolId, cancelledById: 'admin', chargeId, reason: 'Erreur de saisie' },
      asGateway(),
      enabled
    )

  it('keeps the month with its reason', async () => {
    expect(await run()).toBe('OK')
    expect(gateway.cancelCharge).toHaveBeenCalledWith(tx, schoolId, chargeId, {
      cancelledById: 'admin',
      cancelReason: 'Erreur de saisie',
    })
  })

  it('requires a reason', async () => {
    expect(
      await cancelChildcareCharge(
        { schoolId, cancelledById: 'admin', chargeId, reason: ' ' },
        asGateway(),
        enabled
      )
    ).toBe('validationError')
  })

  it('does not cross schools', async () => {
    gateway.lockCharges.mockResolvedValue([])

    expect(await run()).toBe('notFound')
    expect(gateway.lockCharges).toHaveBeenCalledWith(tx, schoolId, [chargeId])
  })

  it('refuses a month with money on an active receipt', async () => {
    gateway.lockCharges.mockResolvedValue([{ id: chargeId, cancelled: false, paid: 1000 }])

    expect(await run()).toBe('hasPayments')
    expect(gateway.cancelCharge).not.toHaveBeenCalled()
  })

  it('refuses a second cancellation', async () => {
    gateway.lockCharges.mockResolvedValue([{ id: chargeId, cancelled: true, paid: 0 }])

    expect(await run()).toBe('alreadyCancelled')
  })
})

describe('removeChildcareSubscription', () => {
  const run = () => removeChildcareSubscription({ schoolId, studentId }, asGateway(), enabled)

  it('deletes a subscription with no history', async () => {
    gateway.lockStudentSubscription.mockResolvedValue('sub-1')

    expect(await run()).toBe('OK')
    expect(gateway.deleteSubscription).toHaveBeenCalledWith(tx, schoolId, 'sub-1')
  })

  it('keeps a subscription with billing history', async () => {
    gateway.lockStudentSubscription.mockResolvedValue('sub-1')
    gateway.hasBillingHistory.mockResolvedValue(true)

    expect(await run()).toBe('hasCharges')
    expect(gateway.deleteSubscription).not.toHaveBeenCalled()
  })

  it('answers notFound for another school', async () => {
    expect(await run()).toBe('notFound')
  })
})
