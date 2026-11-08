import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./auth-helper', () => ({ requireSchoolAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/use-cases/payments/record-payment', () => ({ recordPayment: vi.fn() }))
vi.mock('@/use-cases/payments/cancel-payments', () => ({ cancelPayments: vi.fn() }))

const auth = await import('./auth-helper')
const { revalidatePath } = await import('next/cache')
const { recordPayment } = await import('@/use-cases/payments/record-payment')
const { cancelPayments } = await import('@/use-cases/payments/cancel-payments')
const { cancelPaymentsAction, recordPaymentAction } = await import('./payment-actions')

const input = {
  familyId: '00000000-0000-4000-8000-000000000001',
  enrollmentId: '00000000-0000-4000-8000-000000000002',
  amount: 32_000,
  method: 'CASH' as const,
  paidAt: new Date('2026-10-30'),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.requireSchoolAdmin).mockResolvedValue({ schoolId: 's', userId: 'u' } as never)
})

describe('recordPaymentAction', () => {
  it('forwards the targeted enrollment under the admin school', async () => {
    vi.mocked(recordPayment).mockResolvedValue('OK')

    expect(await recordPaymentAction(input)).toBe('OK')
    expect(recordPayment).toHaveBeenCalledWith({ ...input, schoolId: 's', recordedById: 'u' })
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/families/${input.familyId}`)
  })

  it('returns the typed refusal without revalidating', async () => {
    vi.mocked(recordPayment).mockResolvedValue('enrollmentNotPayable')

    expect(await recordPaymentAction(input)).toBe('enrollmentNotPayable')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('returns the issued receipt so the dialog can open it', async () => {
    vi.mocked(recordPayment).mockResolvedValue({ receiptId: 'receipt-1' })

    expect(await recordPaymentAction({ ...input, generateReceipt: true })).toEqual({
      receiptId: 'receipt-1',
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/families/${input.familyId}`)
  })
})

describe('cancelPaymentsAction', () => {
  const ids = ['00000000-0000-4000-8000-000000000003']

  it('cancels as the admin of the active school and refreshes the family', async () => {
    vi.mocked(cancelPayments).mockResolvedValue({
      familyId: input.familyId,
      cancelledPaymentIds: ids,
      amount: 32_000,
    })

    expect(await cancelPaymentsAction(ids, 'Doublon')).toBe('OK')
    expect(cancelPayments).toHaveBeenCalledWith({
      paymentIds: ids,
      reason: 'Doublon',
      schoolId: 's',
      cancelledById: 'u',
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/families/${input.familyId}`)
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/payments')
  })

  it.each(['notFound', 'onlinePayment', 'receiptPayment', 'mixedFamilies'] as const)(
    'returns %s without revalidating',
    async (code) => {
      vi.mocked(cancelPayments).mockResolvedValue(code)

      expect(await cancelPaymentsAction(ids)).toBe(code)
      expect(revalidatePath).not.toHaveBeenCalled()
    }
  )

  it('stops at the admin guard before touching the use case', async () => {
    vi.mocked(auth.requireSchoolAdmin).mockRejectedValue(new Error('NEXT_NOT_FOUND'))

    await expect(cancelPaymentsAction(ids)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(cancelPayments).not.toHaveBeenCalled()
  })
})
