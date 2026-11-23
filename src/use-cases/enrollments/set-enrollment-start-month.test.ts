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
    firstInstallmentAmount: null,
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
      {
        startMonth: new Date('2026-10-01T00:00:00.000Z'),
        firstInstallmentAmount: null,
        discount: 0,
        totalAmount: 128_000,
      },
      tx
    )
  })

  it('keeps the discount on the part due', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(enrollment({ discount: 8_000 }))

    await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-10' })

    expect(enrollmentGatewayMock.updateStartMonth).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      expect.objectContaining({ discount: 8_000, totalAmount: 120_000 }),
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
      { startMonth: null, firstInstallmentAmount: null, discount: 0, totalAmount: 144_000 },
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

  it('replaces the first month with the reduced amount: 8 000 then 7 × 16 000', async () => {
    expect(
      await setEnrollmentStartMonth({
        schoolId,
        enrollmentId,
        startMonth: '2026-10',
        firstInstallmentAmount: 8_000,
      })
    ).toBe('OK')

    expect(enrollmentGatewayMock.updateStartMonth).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      {
        startMonth: new Date('2026-10-01T00:00:00.000Z'),
        firstInstallmentAmount: 8_000,
        discount: 0,
        totalAmount: 120_000,
      },
      tx
    )
  })

  it('sets the reduced amount on an unchanged month', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(
      enrollment({ startMonth: new Date('2026-10-01T00:00:00Z'), totalAmount: 128_000 })
    )

    await setEnrollmentStartMonth({
      schoolId,
      enrollmentId,
      startMonth: '2026-10',
      firstInstallmentAmount: 8_000,
    })

    expect(enrollmentGatewayMock.updateStartMonth).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      expect.objectContaining({ firstInstallmentAmount: 8_000, totalAmount: 120_000 }),
      tx
    )
  })

  it('resets the reduced amount when the month changes without it', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(
      enrollment({
        startMonth: new Date('2026-10-01T00:00:00Z'),
        firstInstallmentAmount: 8_000,
        totalAmount: 120_000,
      })
    )

    await setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth: '2026-11' })

    expect(enrollmentGatewayMock.updateStartMonth).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      {
        startMonth: new Date('2026-11-01T00:00:00.000Z'),
        firstInstallmentAmount: null,
        discount: 0,
        totalAmount: 112_000,
      },
      tx
    )
  })

  it('removes the discount in the same write when asked', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(
      enrollment({
        startMonth: new Date('2026-10-01T00:00:00Z'),
        discount: 8_000,
        totalAmount: 120_000,
      })
    )

    await setEnrollmentStartMonth({
      schoolId,
      enrollmentId,
      startMonth: '2026-10',
      firstInstallmentAmount: 8_000,
      removeDiscount: true,
    })

    expect(enrollmentGatewayMock.updateStartMonth).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      expect.objectContaining({ firstInstallmentAmount: 8_000, discount: 0, totalAmount: 120_000 }),
      tx
    )
  })

  it('keeps the discount on the following installments', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(enrollment({ discount: 14_000 }))

    await setEnrollmentStartMonth({
      schoolId,
      enrollmentId,
      startMonth: '2026-10',
      firstInstallmentAmount: 8_000,
    })

    expect(enrollmentGatewayMock.updateStartMonth).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      expect.objectContaining({
        firstInstallmentAmount: 8_000,
        discount: 14_000,
        totalAmount: 106_000,
      }),
      tx
    )
  })

  it('refuses a reduced amount without a month, above the installment or on a non-monthly plan', async () => {
    const reduce = (startMonth: string | null, firstInstallmentAmount: number) =>
      setEnrollmentStartMonth({ schoolId, enrollmentId, startMonth, firstInstallmentAmount })

    expect(await reduce(null, 8_000)).toBe('firstInstallmentRequiresStartMonth')
    expect(await reduce('2026-10', 16_001)).toBe('firstInstallmentOutOfRange')
    expect(await reduce('2026-10', 0)).toBe('validationError')

    enrollmentGatewayMock.findById.mockResolvedValue(
      enrollment({
        plan: {
          amount: 144_000,
          paymentSchedule: { mode: 'QUARTERLY', firstMonth: 9, count: 3, dueDay: 5 },
        },
      })
    )
    expect(await reduce('2026-10', 8_000)).toBe('firstInstallmentNotMonthly')
    expect(enrollmentGatewayMock.updateStartMonth).not.toHaveBeenCalled()
  })

  it('refuses a reduced amount above the total the discount leaves', async () => {
    // Last month only: 16 000 owed, reduced to 8 000, minus a 4 000 discount.
    enrollmentGatewayMock.findById.mockResolvedValue(enrollment({ discount: 4_000 }))

    expect(
      await setEnrollmentStartMonth({
        schoolId,
        enrollmentId,
        startMonth: '2027-05',
        firstInstallmentAmount: 8_000,
      })
    ).toBe('firstInstallmentExceedsTotal')
  })

  it('keeps the paid guard with a reduced amount', async () => {
    paid(121_000)

    expect(
      await setEnrollmentStartMonth({
        schoolId,
        enrollmentId,
        startMonth: '2026-10',
        firstInstallmentAmount: 8_000,
      })
    ).toBe('totalBelowPaid')
    expect(enrollmentGatewayMock.updateStartMonth).not.toHaveBeenCalled()
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
