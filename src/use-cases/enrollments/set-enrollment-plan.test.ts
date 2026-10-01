import { beforeEach, describe, expect, it, vi } from 'vitest'

const enrollmentGatewayMock = {
  findOpenById: vi.fn(),
  findDebtorFamily: vi.fn(),
  findOpenActivePayments: vi.fn(),
  assignPlan: vi.fn(),
}
const planGatewayMock = {
  findById: vi.fn(),
}
const paymentGatewayMock = {
  lockFamilyForPayment: vi.fn(),
}
const isPaymentsEnabledMock = vi.fn()
const tx = { marker: 'tx' }
const transaction = vi.fn()

vi.mock('@/lib/db', () => ({ db: { $transaction: transaction } }))

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

vi.mock('@/gateways/plan-gateway', () => ({
  planGateway: planGatewayMock,
}))

vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: paymentGatewayMock,
}))

vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, mais sa factory est lazy. Même
// motif que `create-enrollment.test.ts` et `class-period-gateway.test.ts`.
const { setEnrollmentPlan } = await import('./set-enrollment-plan')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'
const enrollmentId = '550e8400-e29b-41d4-a716-446655440001'
const planId = '550e8400-e29b-41d4-a716-446655440002'
const familyId = '550e8400-e29b-41d4-a716-446655440003'

const validInput = { schoolId, enrollmentId, planId }

describe('setEnrollmentPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isPaymentsEnabledMock.mockResolvedValue(true)
    enrollmentGatewayMock.findOpenById.mockResolvedValue({
      id: enrollmentId,
      discount: 20,
    })
    enrollmentGatewayMock.findDebtorFamily.mockResolvedValue({ familyId })
    enrollmentGatewayMock.findOpenActivePayments.mockResolvedValue({ payments: [{ amount: 30 }] })
    planGatewayMock.findById.mockResolvedValue({
      id: planId,
      name: 'Tarif annuel',
      amount: 100,
    })
    paymentGatewayMock.lockFamilyForPayment.mockResolvedValue(true)
    transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
    enrollmentGatewayMock.assignPlan.mockResolvedValue({ id: enrollmentId })
  })

  it('assigns the plan and recalculates the total on its current price minus the enrollment discount', async () => {
    const result = await setEnrollmentPlan(validInput)

    expect(result).toBe('OK')
    // 100 (prix courant de la formule) - 20 (remise inchangée de l'inscription) = 80.
    expect(enrollmentGatewayMock.assignPlan).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      planId,
      80,
      tx
    )
  })

  it('fails validation with a malformed input', async () => {
    const result = await setEnrollmentPlan({ schoolId, enrollmentId, planId: 'not-a-uuid' })

    expect(result).toBe('validationError')
    expect(enrollmentGatewayMock.findOpenById).not.toHaveBeenCalled()
  })

  it('refuses with paymentsDisabled when the school turned payments off, without reading further', async () => {
    isPaymentsEnabledMock.mockResolvedValue(false)

    const result = await setEnrollmentPlan(validInput)

    expect(result).toBe('paymentsDisabled')
    expect(enrollmentGatewayMock.findOpenById).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
    expect(enrollmentGatewayMock.assignPlan).not.toHaveBeenCalled()
  })

  it('refuses with notFound when the enrollment is not open (or gone)', async () => {
    enrollmentGatewayMock.findOpenById.mockResolvedValue(null)

    const result = await setEnrollmentPlan(validInput)

    expect(result).toBe('notFound')
    expect(planGatewayMock.findById).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
    expect(enrollmentGatewayMock.assignPlan).not.toHaveBeenCalled()
  })

  it('refuses with notFound when the target plan does not exist', async () => {
    planGatewayMock.findById.mockResolvedValue(null)

    const result = await setEnrollmentPlan(validInput)

    expect(result).toBe('notFound')
    expect(transaction).not.toHaveBeenCalled()
    expect(enrollmentGatewayMock.assignPlan).not.toHaveBeenCalled()
  })

  it('refuses with unpricedPlan when the target is the reserved unpriced plan itself', async () => {
    planGatewayMock.findById.mockResolvedValue({ id: planId, name: '__unpriced__', amount: 0 })

    const result = await setEnrollmentPlan(validInput)

    expect(result).toBe('unpricedPlan')
    expect(transaction).not.toHaveBeenCalled()
    expect(enrollmentGatewayMock.assignPlan).not.toHaveBeenCalled()
  })

  it('refuses with totalBelowPaid when the recalculated total would fall below what is already paid', async () => {
    enrollmentGatewayMock.findOpenById.mockResolvedValue({ id: enrollmentId, discount: 0 })
    enrollmentGatewayMock.findOpenActivePayments.mockResolvedValue({ payments: [{ amount: 60 }] })
    planGatewayMock.findById.mockResolvedValue({ id: planId, name: 'Tarif réduit', amount: 50 })

    const result = await setEnrollmentPlan(validInput)

    expect(result).toBe('totalBelowPaid')
    expect(enrollmentGatewayMock.assignPlan).not.toHaveBeenCalled()
  })

  describe('under the family lock (#425)', () => {
    it('locks the debtor family, rereads the payments, then writes, all in one transaction', async () => {
      const order: string[] = []
      paymentGatewayMock.lockFamilyForPayment.mockImplementation(async () => {
        order.push('lock')
        return true
      })
      enrollmentGatewayMock.findOpenActivePayments.mockImplementation(async () => {
        order.push('reread')
        return { payments: [] }
      })
      enrollmentGatewayMock.assignPlan.mockImplementation(async () => {
        order.push('write')
      })

      expect(await setEnrollmentPlan(validInput)).toBe('OK')

      expect(order).toEqual(['lock', 'reread', 'write'])
      expect(paymentGatewayMock.lockFamilyForPayment).toHaveBeenCalledWith(tx, schoolId, familyId)
      expect(enrollmentGatewayMock.findOpenActivePayments).toHaveBeenCalledWith(
        tx,
        schoolId,
        enrollmentId
      )
      expect(enrollmentGatewayMock.assignPlan).toHaveBeenCalledWith(
        schoolId,
        enrollmentId,
        planId,
        80,
        tx
      )
    })

    it('refuses totalBelowPaid on a payment banked while waiting for the lock', async () => {
      // Total recalculé 80 € ; un encaissement de 100 € est passé sous le verrou avant nous.
      enrollmentGatewayMock.findOpenActivePayments.mockResolvedValue({
        payments: [{ amount: 100 }],
      })

      expect(await setEnrollmentPlan(validInput)).toBe('totalBelowPaid')
      expect(enrollmentGatewayMock.assignPlan).not.toHaveBeenCalled()
    })

    it('answers notFound when the family cannot be locked (archived or gone)', async () => {
      paymentGatewayMock.lockFamilyForPayment.mockResolvedValue(false)

      expect(await setEnrollmentPlan(validInput)).toBe('notFound')
      expect(enrollmentGatewayMock.findOpenActivePayments).not.toHaveBeenCalled()
      expect(enrollmentGatewayMock.assignPlan).not.toHaveBeenCalled()
    })

    it('answers notFound when the enrollment closed before the lock was taken', async () => {
      enrollmentGatewayMock.findOpenActivePayments.mockResolvedValue(null)

      expect(await setEnrollmentPlan(validInput)).toBe('notFound')
      expect(enrollmentGatewayMock.assignPlan).not.toHaveBeenCalled()
    })

    it('skips the lock for a student without a debtor family and still rereads in the transaction', async () => {
      enrollmentGatewayMock.findDebtorFamily.mockResolvedValue({ familyId: null })

      expect(await setEnrollmentPlan(validInput)).toBe('OK')
      expect(paymentGatewayMock.lockFamilyForPayment).not.toHaveBeenCalled()
      expect(enrollmentGatewayMock.findOpenActivePayments).toHaveBeenCalledWith(
        tx,
        schoolId,
        enrollmentId
      )
    })
  })
})
