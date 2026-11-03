import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./auth-helper', () => ({ requireSchoolAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/use-cases/payments/record-payment', () => ({ recordPayment: vi.fn() }))

const auth = await import('./auth-helper')
const { revalidatePath } = await import('next/cache')
const { recordPayment } = await import('@/use-cases/payments/record-payment')
const { recordPaymentAction } = await import('./payment-actions')

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
    expect(recordPayment).toHaveBeenCalledWith({ ...input, schoolId: 's' })
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/families/${input.familyId}`)
  })

  it('returns the typed refusal without revalidating', async () => {
    vi.mocked(recordPayment).mockResolvedValue('enrollmentNotPayable')

    expect(await recordPaymentAction(input)).toBe('enrollmentNotPayable')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
