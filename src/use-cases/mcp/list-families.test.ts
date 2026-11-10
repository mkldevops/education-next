import { describe, expect, it, vi } from 'vitest'
import { listFamiliesFromMcp } from './list-families'

const scope = {
  owner: { kind: 'ADMIN_SESSION' as const, userId: 'user-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  paymentsEnabled: true,
}

const family = {
  id: 'family-1',
  name: 'Madi',
  persons: [
    {
      person: {
        name: 'Ali',
        lastname: 'Madi',
        student: {
          id: 'student-1',
          enrollments: [
            {
              status: 'ACTIVE',
              classAssignments: [{ classPeriod: { id: 'cp-1', name: 'MS' } }],
            },
          ],
        },
      },
    },
  ],
}

const tracking = [
  {
    familyId: 'family-1',
    familyName: 'Madi',
    paidToDate: 32000,
    expectedToDate: 48000,
    overdueAmount: 16000,
    tracked: true,
  },
  {
    familyId: 'family-2',
    familyName: 'Said',
    paidToDate: 48000,
    expectedToDate: 48000,
    overdueAmount: 0,
    tracked: true,
  },
]

describe('listFamiliesFromMcp', () => {
  it('pages through every family with its children, class and payment tracking', async () => {
    const listFamilies = vi.fn().mockResolvedValue({ total: 3, rows: [family] })
    const trackingByFamily = vi.fn().mockResolvedValue(tracking)

    const result = await listFamiliesFromMcp(
      scope as never,
      { limit: 1 },
      { listFamilies } as never,
      trackingByFamily
    )

    expect(listFamilies).toHaveBeenCalledWith('school-1', {
      skip: 0,
      take: 1,
      familyIds: undefined,
    })
    expect(trackingByFamily).toHaveBeenCalledWith('school-1')
    expect(result).toEqual({
      total: 3,
      offset: 0,
      nextOffset: 1,
      families: [
        {
          id: 'family-1',
          name: 'Madi',
          children: [
            {
              studentId: 'student-1',
              name: 'Ali',
              lastname: 'Madi',
              enrollments: [{ status: 'ACTIVE', classes: [{ id: 'cp-1', name: 'MS' }] }],
            },
          ],
          payments: {
            paidToDate: 32000,
            expectedToDate: 48000,
            overdueAmount: 16000,
            tracked: true,
          },
        },
      ],
    })
  })

  it('keeps only overdue families when asked', async () => {
    const listFamilies = vi.fn().mockResolvedValue({ total: 1, rows: [family] })

    const result = await listFamiliesFromMcp(
      scope as never,
      { overdueOnly: true },
      { listFamilies } as never,
      vi.fn().mockResolvedValue(tracking)
    )

    expect(listFamilies).toHaveBeenCalledWith('school-1', {
      skip: 0,
      take: 100,
      familyIds: ['family-1'],
    })
    expect(result).toMatchObject({ nextOffset: null })
  })

  it('omits payments and skips their read when payments are disabled', async () => {
    const listFamilies = vi.fn().mockResolvedValue({ total: 1, rows: [family] })
    const trackingByFamily = vi.fn()
    const disabled = { ...scope, paymentsEnabled: false }

    const result = await listFamiliesFromMcp(
      disabled as never,
      {},
      { listFamilies } as never,
      trackingByFamily
    )

    expect(trackingByFamily).not.toHaveBeenCalled()
    expect(result).not.toHaveProperty('families.0.payments')
    expect(
      await listFamiliesFromMcp(
        disabled as never,
        { overdueOnly: true },
        { listFamilies } as never,
        trackingByFamily
      )
    ).toBe('paymentsDisabled')
  })
})
