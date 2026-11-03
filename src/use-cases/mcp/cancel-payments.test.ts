import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/use-cases/payments/cancel-payments', () => ({ cancelPayments: vi.fn() }))

const { cancelPayments } = await import('@/use-cases/payments/cancel-payments')
const { cancelPaymentsFromMcp } = await import('./cancel-payments')

const scope = {
  owner: { kind: 'ADMIN_SESSION' as const, userId: 'user-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  paymentsEnabled: true,
}
const idA = '11111111-1111-4111-8111-111111111111'

beforeEach(() => vi.clearAllMocks())

describe('cancelPaymentsFromMcp', () => {
  it('runs the shared cancellation as the caller, with its reason', async () => {
    vi.mocked(cancelPayments).mockResolvedValue('receiptPayment')

    const result = await cancelPaymentsFromMcp(scope, { paymentIds: [idA], reason: 'Doublon' })

    expect(result).toBe('receiptPayment')
    expect(cancelPayments).toHaveBeenCalledWith({
      paymentIds: [idA],
      reason: 'Doublon',
      schoolId: 'school-1',
      cancelledById: 'user-1',
    })
  })

  it('refuses without calling the use case when payments are disabled', async () => {
    const result = await cancelPaymentsFromMcp(
      { ...scope, paymentsEnabled: false },
      {
        paymentIds: [idA],
      }
    )

    expect(result).toBe('paymentsDisabled')
    expect(cancelPayments).not.toHaveBeenCalled()
  })

  it('rejects an empty list', async () => {
    expect(await cancelPaymentsFromMcp(scope, { paymentIds: [] })).toBe('validationError')
    expect(cancelPayments).not.toHaveBeenCalled()
  })
})
