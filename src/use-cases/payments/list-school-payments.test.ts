import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  payment: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

const { listSchoolPayments } = await import('./list-school-payments')

const paidAt = new Date('2026-09-12T00:00:00.000Z')
const createdAt = new Date('2026-09-12T10:00:00.000Z')

function line(overrides: {
  id: string
  enrollmentId: string
  amount: number
  method?: string
  student?: string
}) {
  return {
    id: overrides.id,
    familyId: 'family-1',
    enrollmentId: overrides.enrollmentId,
    paymentTransactionId: null,
    amount: overrides.amount,
    method: overrides.method ?? 'CASH',
    reference: null,
    paidAt,
    cashedAt: null,
    createdAt,
    family: { name: 'Diallo' },
    enrollment: {
      student: { person: { name: overrides.student ?? 'Awa', lastname: 'Diallo' } },
    },
  }
}

describe('listSchoolPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the whole history once, projected on the displayed fields, without a period', async () => {
    dbMock.payment.findMany.mockResolvedValue([
      line({ id: 'p-a', enrollmentId: 'enrollment-a', amount: 180 }),
      line({ id: 'p-b', enrollmentId: 'enrollment-b', amount: 120, student: 'Moussa' }),
    ])

    const payments = await listSchoolPayments('school-1', null)

    expect(dbMock.payment.findMany).toHaveBeenCalledTimes(1)
    const query = dbMock.payment.findMany.mock.calls[0][0]
    expect(query.where).toEqual({ schoolId: 'school-1' })
    expect(query.include).toBeUndefined()
    expect(query.select.family).toEqual({ select: { name: true } })
    expect(query.select.enrollment).toEqual({
      select: { student: { select: { person: { select: { name: true, lastname: true } } } } },
    })
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ id: 'p-a', amount: 300, periodAmount: 300 })
    expect(payments[0].lines.map((entry) => entry.id)).toEqual(['p-a', 'p-b'])
  })

  it('filters the period in the database, then rereads the sibling rows of each payment', async () => {
    dbMock.payment.findMany
      .mockResolvedValueOnce([{ id: 'p-old', familyId: 'family-1', paidAt }])
      .mockResolvedValueOnce([
        // Même versement : la ligne de l'ancienne période (120) et celle de la nouvelle (180).
        line({ id: 'p-old', enrollmentId: 'enrollment-old', amount: 120 }),
        line({ id: 'p-new', enrollmentId: 'enrollment-new', amount: 180, student: 'Moussa' }),
        // Autre versement de la même famille le même jour, hors période : ignoré.
        line({ id: 'p-check', enrollmentId: 'enrollment-new', amount: 50, method: 'CHECK' }),
      ])

    const payments = await listSchoolPayments('school-1', 'period-1')

    expect(dbMock.payment.findMany).toHaveBeenCalledTimes(2)
    expect(dbMock.payment.findMany.mock.calls[0][0]).toEqual({
      where: {
        schoolId: 'school-1',
        enrollment: { classAssignments: { some: { classPeriod: { periodId: 'period-1' } } } },
      },
      select: { id: true, familyId: true, paidAt: true },
    })
    expect(dbMock.payment.findMany.mock.calls[1][0].where).toEqual({
      schoolId: 'school-1',
      familyId: { in: ['family-1'] },
      paidAt: { in: [paidAt] },
    })
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ id: 'p-old', amount: 300, periodAmount: 120 })
    expect(payments[0].lines.map((entry) => entry.id)).toEqual(['p-old', 'p-new'])
  })

  it('deduplicates the families and dates handed to the sibling query', async () => {
    dbMock.payment.findMany
      .mockResolvedValueOnce([
        { id: 'p-1', familyId: 'family-1', paidAt: new Date(paidAt) },
        { id: 'p-2', familyId: 'family-1', paidAt: new Date(paidAt) },
        { id: 'p-3', familyId: 'family-2', paidAt: new Date('2026-09-13T00:00:00.000Z') },
      ])
      .mockResolvedValueOnce([])

    await listSchoolPayments('school-1', 'period-1')

    expect(dbMock.payment.findMany.mock.calls[1][0].where).toEqual({
      schoolId: 'school-1',
      familyId: { in: ['family-1', 'family-2'] },
      paidAt: { in: [paidAt, new Date('2026-09-13T00:00:00.000Z')] },
    })
  })

  it('returns nothing without a second query when the period has no payment', async () => {
    dbMock.payment.findMany.mockResolvedValueOnce([])

    await expect(listSchoolPayments('school-1', 'period-1')).resolves.toEqual([])

    expect(dbMock.payment.findMany).toHaveBeenCalledTimes(1)
  })
})
