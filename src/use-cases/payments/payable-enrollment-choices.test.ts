import { describe, expect, it, vi } from 'vitest'

const findPayableByFamily = vi.fn()
vi.mock('@/gateways/enrollment-gateway', () => ({ enrollmentGateway: { findPayableByFamily } }))

const { listPayableEnrollmentChoices } = await import('./payable-enrollment-choices')

describe('listPayableEnrollmentChoices', () => {
  it('lists the enrollments still owing money with their child', async () => {
    findPayableByFamily.mockResolvedValue([
      { id: 'e1', studentName: 'Zaynab A', totalAmount: 64_000, discount: 0, payments: [] },
      {
        id: 'e2',
        studentName: 'Waliya T',
        totalAmount: 68_000,
        discount: 0,
        payments: [{ amount: 68_000 }],
      },
    ])

    expect(await listPayableEnrollmentChoices('school', 'family')).toEqual([
      { enrollmentId: 'e1', studentName: 'Zaynab A', remainingBalance: 64_000 },
    ])
    expect(findPayableByFamily).toHaveBeenCalledWith('school', 'family')
  })
})
