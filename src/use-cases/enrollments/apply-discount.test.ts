import { beforeEach, describe, expect, it, vi } from 'vitest'

const enrollmentGatewayMock = {
  findById: vi.fn(),
  findDebtorFamily: vi.fn(),
  findOpenActivePayments: vi.fn(),
  updateDiscount: vi.fn(),
}
const paymentGatewayMock = {
  lockFamilyForPayment: vi.fn(),
}
const configGatewayMock = {
  get: vi.fn(),
}
const tx = { marker: 'tx' }
const transaction = vi.fn()

vi.mock('@/lib/db', () => ({ db: { $transaction: transaction } }))

vi.mock('@/gateways/enrollment-gateway', () => ({
  enrollmentGateway: enrollmentGatewayMock,
}))

vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: paymentGatewayMock,
}))

vi.mock('@/gateways/config-gateway', () => ({
  configGateway: configGatewayMock,
}))

const { applyDiscount } = await import('./apply-discount')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'
const enrollmentId = '550e8400-e29b-41d4-a716-446655440000'
const familyId = '550e8400-e29b-41d4-a716-446655440077'

describe('applyDiscount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enrollmentGatewayMock.findById = vi.fn()
    enrollmentGatewayMock.findDebtorFamily = vi.fn().mockResolvedValue({ familyId })
    enrollmentGatewayMock.findOpenActivePayments = vi.fn().mockResolvedValue({ payments: [] })
    enrollmentGatewayMock.updateDiscount = vi.fn()
    paymentGatewayMock.lockFamilyForPayment = vi.fn().mockResolvedValue(true)
    transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
    configGatewayMock.get = vi.fn().mockResolvedValue({ value: 'true' })
  })

  it('should fail validation with invalid input', async () => {
    const result = await applyDiscount({
      schoolId,
      enrollmentId: 'invalid-uuid',
      discount: 10,
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation with negative discount', async () => {
    const result = await applyDiscount({
      schoolId,
      enrollmentId,
      discount: -10,
    })

    expect(result).toBe('validationError')
  })

  it('should refuse to apply a discount when payments are disabled', async () => {
    configGatewayMock.get.mockResolvedValue({ value: 'false' })

    const result = await applyDiscount({
      schoolId,
      enrollmentId,
      discount: 10,
    })

    expect(result).toBe('paymentsDisabled')
    expect(enrollmentGatewayMock.findById).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
    expect(enrollmentGatewayMock.updateDiscount).not.toHaveBeenCalled()
  })

  it('should fail with enrollment not found', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue(null)

    const result = await applyDiscount({
      schoolId,
      enrollmentId,
      discount: 10,
    })

    expect(result).toBe('notFound')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('should reject a discount above the plan amount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      schoolId,
      enrollmentId,
      discount: 100.01,
    })

    expect(result).toBe('discountExceedsPlan')
    expect(transaction).not.toHaveBeenCalled()
    expect(enrollmentGatewayMock.updateDiscount).not.toHaveBeenCalled()
  })

  it('should accept a discount equal to the plan amount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      schoolId,
      enrollmentId,
      discount: 100,
    })

    expect(result).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      100,
      0,
      tx
    )
  })

  it('should succeed when applying discount to existing enrollment', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      schoolId,
      enrollmentId,
      discount: 10,
    })

    expect(result).toBe('OK')
  })

  it('should update enrollment with correct discount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      plan: { amount: 100 },
    })

    await applyDiscount({
      schoolId,
      enrollmentId,
      discount: 10,
    })

    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      10,
      90,
      tx
    )
  })

  it('should calculate correct total amount after discount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      plan: { amount: 100 },
    })

    await applyDiscount({
      schoolId,
      enrollmentId,
      discount: 25,
    })

    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      25,
      75,
      tx
    )
  })

  it('should handle zero discount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      schoolId,
      enrollmentId,
      discount: 0,
    })

    expect(result).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      0,
      100,
      tx
    )
  })

  it('derives a 60 euro discount from a final amount of 240 euros', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      status: 'ACTIVE',
      plan: { amount: 300 },
    })

    expect(
      await applyDiscount({
        schoolId,
        enrollmentId,
        totalAmount: 240,
      })
    ).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      60,
      240,
      tx
    )
  })

  it('refuses a final amount lower than recorded payments', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      status: 'ACTIVE',
      plan: { amount: 300 },
    })
    enrollmentGatewayMock.findOpenActivePayments.mockResolvedValue({
      payments: [{ amount: 250 }],
    })

    expect(
      await applyDiscount({
        schoolId,
        enrollmentId,
        totalAmount: 240,
      })
    ).toBe('totalBelowPaid')
    expect(enrollmentGatewayMock.updateDiscount).not.toHaveBeenCalled()
  })

  it('refuses a final amount with more than two decimal places', async () => {
    expect(
      await applyDiscount({
        schoolId,
        enrollmentId,
        totalAmount: 240.001,
      })
    ).toBe('validationError')
    expect(enrollmentGatewayMock.findById).not.toHaveBeenCalled()
  })

  it('should handle discount equal to plan amount', async () => {
    enrollmentGatewayMock.findById.mockResolvedValue({
      id: enrollmentId,
      plan: { amount: 100 },
    })

    const result = await applyDiscount({
      schoolId,
      enrollmentId,
      discount: 100,
    })

    expect(result).toBe('OK')
    expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
      schoolId,
      enrollmentId,
      100,
      0,
      tx
    )
  })

  describe('under the family lock (#425)', () => {
    beforeEach(() => {
      enrollmentGatewayMock.findById.mockResolvedValue({
        id: enrollmentId,
        status: 'ACTIVE',
        // Lus hors verrou : ces paiements ne décident de rien.
        payments: [],
        plan: { amount: 100 },
      })
    })

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
      enrollmentGatewayMock.updateDiscount.mockImplementation(async () => {
        order.push('write')
      })

      expect(await applyDiscount({ schoolId, enrollmentId, totalAmount: 50 })).toBe('OK')

      expect(order).toEqual(['lock', 'reread', 'write'])
      expect(paymentGatewayMock.lockFamilyForPayment).toHaveBeenCalledWith(tx, schoolId, familyId)
      expect(enrollmentGatewayMock.findOpenActivePayments).toHaveBeenCalledWith(
        tx,
        schoolId,
        enrollmentId
      )
      expect(enrollmentGatewayMock.updateDiscount).toHaveBeenCalledWith(
        schoolId,
        enrollmentId,
        50,
        50,
        tx
      )
    })

    it('refuses totalBelowPaid on a payment banked while waiting for the lock, even though the pre-lock read saw none', async () => {
      // Scénario de #425 : total 100 €, payé 0 € à la lecture ; un encaissement de 100 €
      // passe sous le verrou avant nous. La relecture verrouillée doit trancher.
      enrollmentGatewayMock.findOpenActivePayments.mockResolvedValue({
        payments: [{ amount: 100 }],
      })

      expect(await applyDiscount({ schoolId, enrollmentId, totalAmount: 50 })).toBe(
        'totalBelowPaid'
      )
      expect(enrollmentGatewayMock.updateDiscount).not.toHaveBeenCalled()
    })

    it('answers notFound when the family cannot be locked (archived or gone)', async () => {
      paymentGatewayMock.lockFamilyForPayment.mockResolvedValue(false)

      expect(await applyDiscount({ schoolId, enrollmentId, totalAmount: 50 })).toBe('notFound')
      expect(enrollmentGatewayMock.findOpenActivePayments).not.toHaveBeenCalled()
      expect(enrollmentGatewayMock.updateDiscount).not.toHaveBeenCalled()
    })

    it('answers notFound when the enrollment closed before the lock was taken', async () => {
      enrollmentGatewayMock.findOpenActivePayments.mockResolvedValue(null)

      expect(await applyDiscount({ schoolId, enrollmentId, totalAmount: 50 })).toBe('notFound')
      expect(enrollmentGatewayMock.updateDiscount).not.toHaveBeenCalled()
    })

    it('skips the lock for a student without a debtor family and still rereads in the transaction', async () => {
      enrollmentGatewayMock.findDebtorFamily.mockResolvedValue({ familyId: null })

      expect(await applyDiscount({ schoolId, enrollmentId, totalAmount: 50 })).toBe('OK')
      expect(paymentGatewayMock.lockFamilyForPayment).not.toHaveBeenCalled()
      expect(enrollmentGatewayMock.findOpenActivePayments).toHaveBeenCalledWith(
        tx,
        schoolId,
        enrollmentId
      )
    })
  })
})
