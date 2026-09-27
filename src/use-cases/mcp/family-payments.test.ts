import { beforeEach, describe, expect, it, vi } from 'vitest'

const findById = vi.fn()
const findPayableByFamily = vi.fn()
const listFamilyPayments = vi.fn()

vi.mock('@/gateways/family-gateway', () => ({ familyGateway: { findById } }))
vi.mock('@/gateways/enrollment-gateway', () => ({ enrollmentGateway: { findPayableByFamily } }))
vi.mock('@/gateways/mcp-read-gateway', () => ({ mcpReadGateway: { listFamilyPayments } }))

const { familyPaymentsFromMcp } = await import('./family-payments')

const scope = {
  owner: { kind: 'ADMIN_SESSION' as const, userId: 'user-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  paymentsEnabled: true,
}
const familyId = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  findById.mockResolvedValue({ id: familyId, name: 'Madi' })
  findPayableByFamily.mockResolvedValue([
    { id: 'enr-1', totalAmount: 100, discount: 0, payments: [{ amount: 40 }] },
  ])
  listFamilyPayments.mockResolvedValue([
    {
      id: 'pay-1',
      amount: { toString: () => '40.00' },
      method: 'CASH',
      reference: null,
      paidAt: new Date('2026-09-12'),
      cashedAt: null,
      paymentTransactionId: null,
      enrollment: { id: 'enr-1', student: { person: { name: 'Ali', lastname: 'Madi' } } },
    },
  ])
})

describe('familyPaymentsFromMcp', () => {
  it('returns the remaining balance and the recent payments with their ids', async () => {
    const result = await familyPaymentsFromMcp(scope as never, { familyId })

    expect(result).toMatchObject({
      family: { id: familyId, name: 'Madi' },
      remainingBalance: 60,
      payments: [
        {
          id: 'pay-1',
          amount: '40.00',
          online: false,
          enrollmentId: 'enr-1',
          student: { name: 'Ali', lastname: 'Madi' },
        },
      ],
    })
    expect(listFamilyPayments).toHaveBeenCalledWith('school-1', familyId, 20)
  })

  it('answers notFound for a family outside the school', async () => {
    findById.mockResolvedValue(null)

    expect(await familyPaymentsFromMcp(scope as never, { familyId })).toBe('notFound')
    expect(listFamilyPayments).not.toHaveBeenCalled()
  })

  it('refuses when payments are disabled', async () => {
    const result = await familyPaymentsFromMcp({ ...scope, paymentsEnabled: false } as never, {
      familyId,
    })

    expect(result).toBe('paymentsDisabled')
    expect(findById).not.toHaveBeenCalled()
  })
})
