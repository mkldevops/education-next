import { beforeEach, describe, expect, it, vi } from 'vitest'

const findById = vi.fn()
const findPayableByFamily = vi.fn()
const listFamilyPayments = vi.fn()
const getFamilyPaymentTracking = vi.fn()
const listEnrollmentSchedules = vi.fn()

vi.mock('@/use-cases/payments/payment-tracking', () => ({ getFamilyPaymentTracking }))
vi.mock('@/gateways/family-gateway', () => ({ familyGateway: { findById } }))
vi.mock('@/gateways/enrollment-gateway', () => ({ enrollmentGateway: { findPayableByFamily } }))
vi.mock('@/gateways/mcp-read-gateway', () => ({
  mcpReadGateway: { listFamilyPayments, listEnrollmentSchedules },
}))
vi.mock('@/lib/school-regional-settings', () => ({
  getSchoolRegionalSettings: vi.fn().mockResolvedValue({ currency: 'EUR', timeZone: 'UTC' }),
}))

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
  getFamilyPaymentTracking.mockResolvedValue({
    expectedToDate: 50,
    overdueAmount: 10,
    tracked: true,
    paidToDate: 40,
  })
  findById.mockResolvedValue({ id: familyId, name: 'Madi' })
  findPayableByFamily.mockResolvedValue([
    {
      id: 'enr-1',
      totalAmount: 100,
      discount: 0,
      payments: [{ amount: 40 }],
      studentName: 'Ali Madi',
    },
  ])
  listEnrollmentSchedules.mockResolvedValue([
    {
      id: 'enr-1',
      totalAmount: 100,
      startMonth: null,
      plan: { paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 4, dueDay: 10 } },
      classAssignments: [
        { classPeriod: { period: { startAt: new Date('2026-09-01T00:00:00Z') } } },
      ],
    },
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
      paidAmount: 40,
      tracking: { expectedToDate: 50, overdueAmount: 10, tracked: true, paidToDate: 40 },
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
    expect(getFamilyPaymentTracking).toHaveBeenCalledWith('school-1', familyId)
  })

  it('tells which installments the payments received cover', async () => {
    const result = await familyPaymentsFromMcp(scope as never, { familyId })

    expect(result).toMatchObject({
      enrollments: [
        {
          enrollmentId: 'enr-1',
          student: 'Ali Madi',
          paidAmount: 40,
          installments: [
            { dueDate: '2026-09-10', amount: 25, paidAmount: 25, status: 'PAID' },
            { dueDate: '2026-10-10', amount: 25, paidAmount: 15, status: 'PARTIAL' },
            { dueDate: '2026-11-10', amount: 25, paidAmount: 0, status: 'UNPAID' },
            { dueDate: '2026-12-10', amount: 25, paidAmount: 0, status: 'UNPAID' },
          ],
        },
      ],
    })
    expect(listEnrollmentSchedules).toHaveBeenCalledWith('school-1', ['enr-1'])
  })

  it('answers notFound for a family outside the school', async () => {
    findById.mockResolvedValue(null)

    expect(await familyPaymentsFromMcp(scope as never, { familyId })).toBe('notFound')
    expect(listFamilyPayments).not.toHaveBeenCalled()
    expect(getFamilyPaymentTracking).not.toHaveBeenCalled()
  })

  it('refuses when payments are disabled', async () => {
    const result = await familyPaymentsFromMcp({ ...scope, paymentsEnabled: false } as never, {
      familyId,
    })

    expect(result).toBe('paymentsDisabled')
    expect(findById).not.toHaveBeenCalled()
  })
})
