import { beforeEach, describe, expect, it, vi } from 'vitest'

const enrollmentGatewayMock = {
  findById: vi.fn(),
  findPeriodBounds: vi.fn(),
  findDebtorFamily: vi.fn(),
  findOpenActivePayments: vi.fn(),
  updateStartMonth: vi.fn(),
}
const paymentGatewayMock = { lockFamilyForPayment: vi.fn() }
const configGatewayMock = { get: vi.fn() }
const tx = { marker: 'tx' }
const transaction = vi.fn()

vi.mock('@/lib/db', () => ({ db: { $transaction: transaction } }))
vi.mock('@/gateways/enrollment-gateway', () => ({ enrollmentGateway: enrollmentGatewayMock }))
vi.mock('@/gateways/payment-gateway', () => ({ paymentGateway: paymentGatewayMock }))
vi.mock('@/gateways/config-gateway', () => ({ configGateway: configGatewayMock }))
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi.fn().mockResolvedValue({ currency: 'XOF' }),
}))

const { setEnrollmentStartMonth } = await import('./set-enrollment-start-month')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'
const enrollmentId = '550e8400-e29b-41d4-a716-446655440000'

const monthlyPlan = {
  amount: 144_000,
  paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 9, dueDay: 5 },
}

function enrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: enrollmentId,
    status: 'ACTIVE',
    discount: 0,
    totalAmount: 144_000,
    startMonth: null,
    plan: monthlyPlan,
    ...overrides,
  }
}

function paid(amount: number) {
  enrollmentGatewayMock.findOpenActivePayments.mockResolvedValue({ payments: [{ amount }] })
}

describe('setEnrollmentStartMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enrollmentGatewayMock.findById.mockResolvedValue(enrollment())
    enrollmentGatewayMock.findPeriodBounds.mockResolvedValue({
      startAt: new Date('2026-09-01T00:00:00Z'),
      endAt: new Date('2027-06-30T00:00:00Z'),
    })
    enrollmentGatewayMock.findDebtorFamily.mockResolvedValue({ familyId: 'family-1' })
    paid(0)
    paymentGatewayMock.lockFamilyForPayment.mockResolvedValue(true)
    configGatewayMock.get.mockResolvedValue({ value: 'true' })
    transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
  })

  it('owes only the installments from October: 8 × 16 000', async () => {
    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-10' })).toBe(
      'OK'
    )

    expect(enrollmentGatewayMock.updateStartMonth).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      new Date('2026-10-01T00:00:00.000Z'),
      128_000,
      tx
    )
  })

  it('keeps the discount on the part due', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(enrollment({ discount: 8_000 }))

    await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-10' })

    expect(enrollmentGatewayMock.updateStartMonth).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      expect.any(Date),
      120_000,
      tx
    )
  })

  it('clears the start month back to the full plan without reading the period', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(
      enrollment({ startMonth: new Date('2026-10-01T00:00:00Z'), totalAmount: 128_000 })
    )

    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: null })).toBe('OK')

    expect(enrollmentGatewayMock.findPeriodBounds).not.toHaveBeenCalled()
    expect(enrollmentGatewayMock.updateStartMonth).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      null,
      144_000,
      tx
    )
  })

  it('writes nothing when the month is unchanged', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(
      enrollment({ startMonth: new Date('2026-10-01T00:00:00Z') })
    )

    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-10' })).toBe(
      'OK'
    )
    expect(transaction).not.toHaveBeenCalled()
  })

  it('refuses a month outside the period', async () => {
    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2027-08' })).toBe(
      'startMonthOutsidePeriod'
    )
    expect(enrollmentGatewayMock.updateStartMonth).not.toHaveBeenCalled()
  })

  it('refuses a plan without a payment schedule', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(
      enrollment({ plan: { amount: 100, paymentSchedule: { mode: 'NONE' } } })
    )

    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-10' })).toBe(
      'noPaymentSchedule'
    )
  })

  it('refuses when received payments would exceed the new total', async () => {
    paid(130_000)

    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-10' })).toBe(
      'totalBelowPaid'
    )
    expect(enrollmentGatewayMock.updateStartMonth).not.toHaveBeenCalled()
  })

  it('refuses a discount larger than the part due', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(enrollment({ discount: 130_000 }))

    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-10' })).toBe(
      'discountExceedsPlan'
    )
  })

  it('refuses a closed enrollment, a malformed month and disabled payments', async () => {
    enrollmentGatewayMock.findById.mockResolvedValueOnce(enrollment({ status: 'COMPLETED' }))
    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-10' })).toBe(
      'notFound'
    )

    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-13' })).toBe(
      'validationError'
    )

    configGatewayMock.get.mockResolvedValue({ value: 'false' })
    expect(await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-10' })).toBe(
      'paymentsDisabled'
    )
  })
})
