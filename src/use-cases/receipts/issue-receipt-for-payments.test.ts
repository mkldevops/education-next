import { beforeEach, describe, expect, it, vi } from 'vitest'

const lockFamilyForPayment = vi.fn()
const issueTuitionReceipt = vi.fn()

vi.mock('@/gateways/payment-gateway', () => ({
  paymentGateway: {
    lockFamilyForPayment: (...args: unknown[]) => lockFamilyForPayment(...args),
  },
}))
vi.mock('./issue-tuition-receipt', () => ({ issueTuitionReceipt }))

const { issueReceiptForPayments } = await import('./issue-receipt-for-payments')

type ReceiptGw = Parameters<typeof issueReceiptForPayments>[1]
type ConfigGw = Parameters<typeof issueReceiptForPayments>[2]

const schoolId = 'school-a'
const first = '5d1c9a2e-8b7f-4e3d-a6c5-b4a392817001'
const second = '5d1c9a2e-8b7f-4e3d-a6c5-b4a392817002'
const paidAt = new Date('2026-09-12T00:00:00.000Z')
const tx = { tx: true }

function payment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    familyId: 'family-1',
    amount: 90,
    method: 'CASH',
    reference: '34-45',
    paidAt,
    isActive: true,
    receiptId: null,
    ...overrides,
  }
}

function setup(rows = [payment(first), payment(second)]) {
  const receiptGw = {
    transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    findPaymentsForReceipt: vi.fn().mockResolvedValue(rows),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: 'true' }) }
  const run = (paymentIds = [first, second]) =>
    issueReceiptForPayments(
      { schoolId, recordedById: 'admin-1', paymentIds },
      receiptGw as unknown as ReceiptGw,
      configGw as unknown as ConfigGw
    )
  return { receiptGw, configGw, run }
}

beforeEach(() => {
  vi.clearAllMocks()
  lockFamilyForPayment.mockResolvedValue(true)
  issueTuitionReceipt.mockResolvedValue({ id: 'receipt-1' })
})

describe('issueReceiptForPayments', () => {
  it('issues the receipt under the family lock, scoped to the school', async () => {
    const { receiptGw, run } = setup()

    expect(await run()).toEqual({ receiptId: 'receipt-1' })
    expect(lockFamilyForPayment).toHaveBeenCalledWith(tx, schoolId, 'family-1')
    expect(receiptGw.findPaymentsForReceipt).toHaveBeenLastCalledWith(tx, schoolId, [first, second])
    expect(issueTuitionReceipt).toHaveBeenCalledWith(
      tx,
      schoolId,
      {
        familyId: 'family-1',
        method: 'CASH',
        reference: '34-45',
        paidAt,
        recordedById: 'admin-1',
        idempotencyKey: `payment:${first}`,
        payments: [
          { id: first, amount: 90 },
          { id: second, amount: 90 },
        ],
      },
      receiptGw
    )
  })

  it('treats a payment of another school as missing', async () => {
    const { run } = setup([])

    expect(await run()).toBe('notFound')
    expect(issueTuitionReceipt).not.toHaveBeenCalled()
  })

  it('refuses lines from two families', async () => {
    const { run } = setup([payment(first), payment(second, { familyId: 'family-2' })])

    expect(await run()).toBe('notFound')
  })

  it('refuses a cancelled payment', async () => {
    const { run } = setup([payment(first), payment(second, { isActive: false })])

    expect(await run()).toBe('notFound')
  })

  it('refuses a payment that already has its receipt', async () => {
    const { run } = setup([payment(first), payment(second, { receiptId: 'receipt-0' })])

    expect(await run()).toBe('alreadyIssued')
    expect(issueTuitionReceipt).not.toHaveBeenCalled()
  })

  it('refuses a refund', async () => {
    const { run } = setup([payment(first, { amount: -90 })])

    expect(await run([first])).toBe('notReceivable')
  })

  it('refuses lines that are not one payment', async () => {
    const { run } = setup([payment(first), payment(second, { method: 'CHECK' })])

    expect(await run()).toBe('validationError')
  })

  it('reports a concurrent issue as already issued', async () => {
    issueTuitionReceipt.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    const { run } = setup()

    expect(await run()).toBe('alreadyIssued')
  })

  it('refuses when payments are disabled', async () => {
    const { configGw, receiptGw, run } = setup()
    configGw.get.mockResolvedValue({ value: 'false' })

    expect(await run()).toBe('paymentsDisabled')
    expect(receiptGw.transaction).not.toHaveBeenCalled()
  })
})
