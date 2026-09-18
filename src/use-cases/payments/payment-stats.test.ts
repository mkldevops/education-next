import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = {
  enrollment: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ db: dbMock }))

const { getPaymentStats } = await import('./payment-stats')

function row(overrides: {
  totalAmount?: number
  families?: Array<{ familyId: string; relationType: string; family: { id: string; name: string } }>
}) {
  return {
    totalAmount: overrides.totalAmount ?? 180,
    student: { person: { families: overrides.families ?? [] } },
    payments: [],
  }
}

describe('getPaymentStats', () => {
  const schoolId = 'school-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores an enrollment attached to no family', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([row({ families: [] })])

    const stats = await getPaymentStats(schoolId, null)

    expect(stats.families).toEqual([])
  })

  it('attributes the debt to the parent family, not the arbitrary one', async () => {
    dbMock.enrollment.findMany.mockResolvedValue([
      row({
        totalAmount: 180,
        families: [
          {
            familyId: 'zzz-other',
            relationType: 'OTHER',
            family: { id: 'zzz-other', name: 'Autre' },
          },
          {
            familyId: 'aaa-parent',
            relationType: 'PARENT',
            family: { id: 'aaa-parent', name: 'Parent' },
          },
        ],
      }),
    ])

    const stats = await getPaymentStats(schoolId, null)

    expect(stats.families).toHaveLength(1)
    expect(stats.families[0].familyId).toBe('aaa-parent')
  })

  it('matches the same debtor family record-payment would collect from', async () => {
    // `family-1` porte OTHER, `family-2` porte PARENT : bien que `family-1` ait un familyId
    // alphabétiquement plus petit, PARENT doit primer, exactement comme
    // `enrollmentGateway.findPayableByFamily`.
    dbMock.enrollment.findMany.mockResolvedValue([
      row({
        totalAmount: 250,
        families: [
          {
            familyId: 'family-1',
            relationType: 'OTHER',
            family: { id: 'family-1', name: 'Famille A' },
          },
          {
            familyId: 'family-2',
            relationType: 'PARENT',
            family: { id: 'family-2', name: 'Famille B' },
          },
        ],
      }),
    ])

    const stats = await getPaymentStats(schoolId, null)

    expect(stats.families).toHaveLength(1)
    expect(stats.families[0].familyId).toBe('family-2')
    expect(stats.families[0].due).toBe(250)
  })
})
