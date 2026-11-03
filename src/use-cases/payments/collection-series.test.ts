import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = { payment: { aggregate: vi.fn(), findMany: vi.fn() } }

vi.mock('@/lib/db', () => ({ db: dbMock }))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { getCollectionSeries } = await import('./collection-series')

const reference = new Date('2026-11-03T10:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.payment.aggregate.mockResolvedValue({
    _max: { paidAt: new Date('2026-11-02T00:00:00.000Z') },
  })
  dbMock.payment.findMany.mockResolvedValue([
    { amount: 60, paidAt: new Date('2026-11-02T00:00:00.000Z') },
  ])
})

describe('getCollectionSeries', () => {
  it('caps the latest-payment lookup at the end of today, within the school scope', async () => {
    await getCollectionSeries(
      'school-1',
      'period-1',
      { granularity: 'day', range: '7d' },
      reference
    )

    expect(dbMock.payment.aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({
        schoolId: 'school-1',
        isActive: true,
        enrollment: expect.objectContaining({
          schoolId: 'school-1',
          classAssignments: { some: { classPeriod: { periodId: 'period-1' } } },
        }),
        paidAt: { lt: new Date('2026-11-04T00:00:00.000Z') },
      }),
      _max: { paidAt: true },
    })
  })

  it('reads only the rows of the charted window', async () => {
    const series = await getCollectionSeries(
      'school-1',
      null,
      { granularity: 'day', range: '7d' },
      reference
    )

    expect(dbMock.payment.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        paidAt: {
          gte: new Date('2026-10-27T00:00:00.000Z'),
          lt: new Date('2026-11-03T00:00:00.000Z'),
        },
      }),
      select: { amount: true, paidAt: true },
    })
    expect(series).toHaveLength(7)
    expect(series.at(-1)).toEqual({ key: '2026-11-02', amount: 60, count: 1 })
  })
})
