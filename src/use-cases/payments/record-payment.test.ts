import { beforeEach, describe, expect, it, vi } from 'vitest'

const enrollmentGatewayMock = {
  findPayableByFamily: vi.fn(),
}
const paymentGatewayMock = {
  lockFamilyForPayment: vi.fn(),
  createForFamily: vi.fn(),
}
const configGatewayMock = {
  get: vi.fn(),
}
const regionalSettingsMock = vi.fn()
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

const issueTuitionReceiptMock = vi.fn()
vi.mock('@/use-cases/receipts/issue-tuition-receipt', () => ({
  issueTuitionReceipt: issueTuitionReceiptMock,
}))

vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: regionalSettingsMock,
}))

const { recordPayment } = await import('./record-payment')

const schoolId = '550e8400-e29b-41d4-a716-446655440099'

describe('recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enrollmentGatewayMock.findPayableByFamily = vi.fn()
    paymentGatewayMock.lockFamilyForPayment = vi.fn().mockResolvedValue(true)
    paymentGatewayMock.createForFamily = vi.fn().mockResolvedValue(['payment-1'])
    transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx))
    configGatewayMock.get = vi.fn().mockResolvedValue({ value: 'true' })
    regionalSettingsMock.mockResolvedValue({ currency: 'EUR', timeZone: 'Europe/Paris' })
    issueTuitionReceiptMock.mockResolvedValue({ id: 'receipt-1' })
  })

  it('should fail validation with invalid input', async () => {
    const result = await recordPayment({
      schoolId,
      familyId: 'invalid-uuid',
      amount: 100,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation with zero amount', async () => {
    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 0,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('validationError')
  })

  it('rejects cents for a currency without minor unit', async () => {
    regionalSettingsMock.mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' })

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 1500.5,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('validationError')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('should fail validation with a cash date on a non-check payment', async () => {
    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      method: 'TRANSFER',
      paidAt: new Date(),
      cashedAt: new Date(),
    })

    expect(result).toBe('validationError')
  })

  it('should refuse to record a payment when payments are disabled', async () => {
    configGatewayMock.get.mockResolvedValue({ value: 'false' })

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('paymentsDisabled')
    expect(transaction).not.toHaveBeenCalled()
    expect(paymentGatewayMock.createForFamily).not.toHaveBeenCalled()
  })

  it('should fail with family not found', async () => {
    paymentGatewayMock.lockFamilyForPayment.mockResolvedValue(false)

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('notFound')
    expect(enrollmentGatewayMock.findPayableByFamily).not.toHaveBeenCalled()
    expect(paymentGatewayMock.createForFamily).not.toHaveBeenCalled()
  })

  it('should fail when no active enrollments found', async () => {
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([])

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 100,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('noPayableEnrollments')
  })

  it('should fail when payment exceeds total balance', async () => {
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        totalAmount: 100,
        discount: 0,
        payments: [],
      },
    ])

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 150,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('overpayment')
  })

  it('should succeed recording payment with valid data', async () => {
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        totalAmount: 100,
        discount: 0,
        payments: [],
      },
    ])

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 50,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('OK')
    expect(issueTuitionReceiptMock).not.toHaveBeenCalled()
  })

  describe('with a receipt', () => {
    const familyId = '550e8400-e29b-41d4-a716-446655440000'
    const paidAt = new Date('2026-09-12T00:00:00.000Z')

    beforeEach(() => {
      enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
        { id: '550e8400-e29b-41d4-a716-446655440001', totalAmount: 100, discount: 0, payments: [] },
        { id: '550e8400-e29b-41d4-a716-446655440002', totalAmount: 100, discount: 0, payments: [] },
      ])
      paymentGatewayMock.createForFamily = vi.fn().mockResolvedValue(['payment-1', 'payment-2'])
    })

    it('issues one receipt for the lines it wrote, keyed by the first payment', async () => {
      const result = await recordPayment({
        schoolId,
        familyId,
        amount: 150,
        method: 'CASH',
        paidAt,
        generateReceipt: true,
        recordedById: 'user-1',
      })

      expect(result).toEqual({ receiptId: 'receipt-1' })
      expect(issueTuitionReceiptMock).toHaveBeenCalledWith(tx, schoolId, {
        familyId,
        method: 'CASH',
        reference: null,
        paidAt,
        recordedById: 'user-1',
        idempotencyKey: 'payment:payment-1',
        payments: [
          { id: 'payment-1', amount: 75 },
          { id: 'payment-2', amount: 75 },
        ],
      })
    })

    it('refuses a receipt without the author who cashed it', async () => {
      const result = await recordPayment({
        schoolId,
        familyId,
        amount: 150,
        method: 'CASH',
        paidAt,
        generateReceipt: true,
      })

      expect(result).toBe('validationError')
      expect(paymentGatewayMock.createForFamily).not.toHaveBeenCalled()
    })

    it('refuses a receipt on a refund', async () => {
      const result = await recordPayment({
        schoolId,
        familyId,
        amount: -50,
        method: 'CASH',
        paidAt,
        generateReceipt: true,
        recordedById: 'user-1',
      })

      expect(result).toBe('validationError')
      expect(issueTuitionReceiptMock).not.toHaveBeenCalled()
    })
  })

  describe('targeting one enrollment (#551)', () => {
    const familyId = '550e8400-e29b-41d4-a716-446655440000'
    const zaynab = '550e8400-e29b-41d4-a716-446655440011'
    const other = '550e8400-e29b-41d4-a716-446655440012'

    beforeEach(() => {
      enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
        { id: zaynab, totalAmount: 64_000, discount: 0, payments: [{ amount: 32_000 }] },
        {
          id: '550e8400-e29b-41d4-a716-446655440013',
          totalAmount: 68_000,
          discount: 0,
          payments: [],
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440014',
          totalAmount: 68_000,
          discount: 0,
          payments: [],
        },
      ])
    })

    const record = (enrollmentId: string, amount = 32_000) =>
      recordPayment({
        schoolId,
        familyId,
        enrollmentId,
        amount,
        method: 'CASH',
        paidAt: new Date(),
      })

    it('writes the whole amount on the chosen enrollment only', async () => {
      expect(await record(zaynab)).toBe('OK')
      expect(paymentGatewayMock.createForFamily).toHaveBeenCalledWith(tx, schoolId, [
        expect.objectContaining({ familyId, enrollmentId: zaynab, amount: 32_000 }),
      ])
    })

    it('rejects an enrollment that is not payable for this family', async () => {
      expect(await record(other)).toBe('enrollmentNotPayable')
      expect(paymentGatewayMock.createForFamily).not.toHaveBeenCalled()
    })

    it('rejects more than the chosen enrollment still owes', async () => {
      expect(await record(zaynab, 32_001)).toBe('overpayment')
      expect(paymentGatewayMock.createForFamily).not.toHaveBeenCalled()
    })

    it('rejects a malformed target before reading balances', async () => {
      expect(await record('not-a-uuid')).toBe('validationError')
      expect(transaction).not.toHaveBeenCalled()
    })
  })

  it('should record payment with correct payment method', async () => {
    const paidAt = new Date()
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        totalAmount: 100,
        discount: 0,
        payments: [],
      },
    ])

    await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 50,
      method: 'CARD',
      paidAt,
    })

    expect(paymentGatewayMock.createForFamily).toHaveBeenCalledWith(
      tx,
      schoolId,
      expect.arrayContaining([
        expect.objectContaining({
          method: 'CARD',
        }),
      ])
    )
  })

  it('should not subtract an enrollment discount twice', async () => {
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        totalAmount: 80,
        discount: 20,
        payments: [],
      },
    ])

    const result = await recordPayment({
      schoolId,
      familyId: '550e8400-e29b-41d4-a716-446655440000',
      amount: 80,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('OK')
    expect(paymentGatewayMock.createForFamily).toHaveBeenCalledWith(tx, schoolId, [
      expect.objectContaining({ amount: 80 }),
    ])
  })

  it('reads the balance under the family lock, in the transaction that writes', async () => {
    const familyId = '550e8400-e29b-41d4-a716-446655440000'
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      { id: '550e8400-e29b-41d4-a716-446655440001', totalAmount: 720, discount: 0, payments: [] },
    ])

    const result = await recordPayment({
      schoolId,
      familyId,
      amount: 720,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('OK')
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(paymentGatewayMock.lockFamilyForPayment).toHaveBeenCalledWith(tx, schoolId, familyId)
    expect(enrollmentGatewayMock.findPayableByFamily).toHaveBeenCalledWith(schoolId, familyId, tx)
    expect(paymentGatewayMock.lockFamilyForPayment.mock.invocationCallOrder[0]).toBeLessThan(
      enrollmentGatewayMock.findPayableByFamily.mock.invocationCallOrder[0]
    )
  })

  it('refuses the second of two payments once the first consumed the balance', async () => {
    const familyId = '550e8400-e29b-41d4-a716-446655440000'
    enrollmentGatewayMock.findPayableByFamily.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        totalAmount: 720,
        discount: 0,
        payments: [{ amount: 720 }],
      },
    ])

    const result = await recordPayment({
      schoolId,
      familyId,
      amount: 720,
      method: 'CASH',
      paidAt: new Date(),
    })

    expect(result).toBe('overpayment')
    expect(paymentGatewayMock.createForFamily).not.toHaveBeenCalled()
  })
})
