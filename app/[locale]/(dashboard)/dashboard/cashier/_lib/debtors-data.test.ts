import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = { student: { findMany: vi.fn() } }
const gatewayMock = {
  findStudentAccounts: vi.fn(),
  transaction: vi.fn((run: (tx: unknown) => unknown) => run({})),
}
const loadSummariesMock = vi.fn()
const familyContactPhonesMock = vi.fn()

vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/gateways/meal-account-gateway', () => ({ mealAccountGateway: gatewayMock }))
vi.mock('@/use-cases/meals/meal-account-summaries', () => ({
  loadMealAccountSummaries: loadSummariesMock,
}))

vi.mock('@/use-cases/payments/payment-stats', () => ({
  familyContactPhones: familyContactPhonesMock,
}))

const { loadMealDebtors, loadMealDues } = await import('./debtors-data')

const TODAY = '2026-11-02'

const summary = (input: {
  dueDays: number
  dueAmount: number
  served: string[]
  left?: number
}) => ({
  served: input.served,
  coverage: {
    paidThrough: null,
    coveredLeft: input.left ?? 0,
    dueDays: input.dueDays,
    dueAmount: input.dueAmount,
    credit: 0,
    surplusValue: 0,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.student.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }])
})

describe('loadMealDues', () => {
  it('totals overdue accounts per service and skips stopped, settled accounts', async () => {
    gatewayMock.findStudentAccounts.mockResolvedValue([
      { id: 'a1', studentId: 's1', service: 'CANTEEN' },
      { id: 'a2', studentId: 's2', service: 'CANTEEN' },
      { id: 'a3', studentId: 's3', service: 'SNACK' },
      { id: 'a4', studentId: 's3', service: 'CANTEEN' },
    ])
    loadSummariesMock.mockResolvedValue(
      new Map([
        ['a1', summary({ dueDays: 3, dueAmount: 2250, served: ['2026-10-30', TODAY] })],
        ['a2', summary({ dueDays: 0, dueAmount: 0, served: [TODAY, '2026-11-03'], left: 10 })],
        ['a3', summary({ dueDays: 2, dueAmount: 1000, served: ['2026-10-30'] })],
        ['a4', summary({ dueDays: 0, dueAmount: 0, served: ['2026-10-01'] })],
      ])
    )

    const dues = await loadMealDues('school-1', TODAY)

    expect(dbMock.student.findMany.mock.calls[0][0].where.schoolId).toBe('school-1')
    expect(gatewayMock.findStudentAccounts).toHaveBeenCalledWith('school-1', ['s1', 's2', 's3'])
    expect(dues).toEqual({
      services: [
        { service: 'CANTEEN', subscribed: 2, upToDate: 1, overdue: 1, dueAmount: 2250 },
        { service: 'SNACK', subscribed: 1, upToDate: 0, overdue: 1, dueAmount: 1000 },
      ],
      toRemind: 2,
      dueAmount: 3250,
    })
  })

  it('counts an up-to-date account whose coverage runs out as one to follow up', async () => {
    gatewayMock.findStudentAccounts.mockResolvedValue([
      { id: 'a1', studentId: 's1', service: 'CANTEEN' },
    ])
    loadSummariesMock.mockResolvedValue(
      new Map([
        [
          'a1',
          summary({
            dueDays: 0,
            dueAmount: 0,
            served: [TODAY, '2026-11-03', '2026-11-04'],
            left: 1,
          }),
        ],
      ])
    )

    const dues = await loadMealDues('school-1', TODAY)

    expect(dues.toRemind).toBe(1)
    expect(dues.dueAmount).toBe(0)
  })
})

describe('loadMealDebtors', () => {
  it('carries the debtor family phone, none for a student without family', async () => {
    dbMock.student.findMany.mockResolvedValue([
      {
        id: 's1',
        person: {
          name: 'Léo',
          lastname: 'Martin',
          families: [{ familyId: 'f1', relationType: 'PARENT' }],
        },
      },
      { id: 's2', person: { name: 'Inès', lastname: 'Ali', families: [] } },
    ])
    gatewayMock.findStudentAccounts.mockResolvedValue([
      { id: 'a1', studentId: 's1', service: 'CANTEEN' },
      { id: 'a2', studentId: 's2', service: 'CANTEEN' },
    ])
    loadSummariesMock.mockResolvedValue(
      new Map([
        ['a1', summary({ dueDays: 2, dueAmount: 1000, served: ['2026-10-30'] })],
        ['a2', summary({ dueDays: 1, dueAmount: 500, served: ['2026-10-30'] })],
      ])
    )
    familyContactPhonesMock.mockResolvedValue(new Map([['f1', '06 12 34 56 78']]))

    const rows = await loadMealDebtors('school-1', TODAY)

    expect(familyContactPhonesMock).toHaveBeenCalledWith('school-1', ['f1'])
    expect(rows.map((row) => [row.name, row.phone])).toEqual([
      ['Léo Martin', '06 12 34 56 78'],
      ['Inès Ali', null],
    ])
  })
})
