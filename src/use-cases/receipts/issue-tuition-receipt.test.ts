import { describe, expect, it, vi } from 'vitest'
import { issueTuitionReceipt } from './issue-tuition-receipt'

type ReceiptGw = Parameters<typeof issueTuitionReceipt>[3]
type Tx = Parameters<typeof issueTuitionReceipt>[0]

const tx = { tx: true } as unknown as Tx
const paidAt = new Date('2026-09-12T00:00:00.000Z')

function setup(attached = 2) {
  const receiptGw = {
    nextNumber: vi.fn().mockResolvedValue(42),
    create: vi.fn().mockResolvedValue({ id: 'receipt-1' }),
    attachPayments: vi.fn().mockResolvedValue({ count: attached }),
  }
  const run = () =>
    issueTuitionReceipt(
      tx,
      'school-1',
      {
        familyId: 'family-1',
        method: 'CASH',
        reference: null,
        paidAt,
        recordedById: 'user-1',
        idempotencyKey: 'payment:payment-1',
        payments: [
          { id: 'payment-2', amount: 0.1 },
          { id: 'payment-1', amount: 0.2 },
        ],
      },
      receiptGw as unknown as ReceiptGw
    )
  return { receiptGw, run }
}

describe('issueTuitionReceipt', () => {
  it('numbers the receipt, totals its lines in cents and attaches them', async () => {
    const { receiptGw, run } = setup()

    expect(await run()).toEqual({ id: 'receipt-1' })
    expect(receiptGw.nextNumber).toHaveBeenCalledWith(tx, 'school-1')
    expect(receiptGw.create).toHaveBeenCalledWith(
      tx,
      'school-1',
      expect.objectContaining({
        familyId: 'family-1',
        number: 42,
        total: 0.3,
        recordedById: 'user-1',
        idempotencyKey: 'payment:payment-1',
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    )
    expect(receiptGw.attachPayments).toHaveBeenCalledWith(tx, 'school-1', 'receipt-1', [
      'payment-2',
      'payment-1',
    ])
  })

  it('aborts the transaction when a line already carries another receipt', async () => {
    const { run } = setup(1)

    await expect(run()).rejects.toThrow()
  })
})
