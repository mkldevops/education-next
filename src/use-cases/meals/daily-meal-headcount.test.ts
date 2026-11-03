import { describe, expect, it, vi } from 'vitest'
import { dailyMealHeadcount } from './daily-meal-headcount'

type AccountGw = Parameters<typeof dailyMealHeadcount>[1]
type ConfigGw = Parameters<typeof dailyMealHeadcount>[2]

const monday = '2026-11-02'
const segment = (accountId: string, staff: { exempt: boolean } | null = null) => ({
  accountId,
  staff,
  weekdays: [1, 2, 3, 4],
  startOn: '2026-09-01',
  endOn: null,
  periodEnd: '2027-06-30',
})

function setup(closures: unknown[] = []) {
  const accountGw = {
    findClosures: vi.fn().mockResolvedValue(closures),
    listDay: vi.fn(async (_schoolId: string, service: string) =>
      service === 'CANTEEN'
        ? {
            segments: [
              segment('a1'),
              segment('a2'),
              segment('t1', { exempt: false }),
              segment('t2', { exempt: true }),
            ],
            absentAccountIds: new Set(['a2']),
          }
        : { segments: [segment('s1')], absentAccountIds: new Set<string>() }
    ),
  }
  const configGw = { get: vi.fn().mockResolvedValue({ value: 'true' }) }
  return dailyMealHeadcount(
    { schoolId: 'school-a', day: monday },
    accountGw as unknown as AccountGw,
    configGw as unknown as ConfigGw
  )
}

describe('dailyMealHeadcount', () => {
  it('counts students and staff per service, apart', async () => {
    expect(await setup()).toEqual({
      CANTEEN: { students: 1, staff: 2, staffFree: 1 },
      SNACK: { students: 1, staff: 0, staffFree: 0 },
    })
  })

  it('serves nobody on a published closure', async () => {
    const closure = {
      status: 'PUBLISHED',
      category: 'CLOSURE',
      startAt: new Date(`${monday}T00:00:00.000Z`),
      endAt: null,
    }
    expect(await setup([closure])).toEqual({
      CANTEEN: { students: 0, staff: 0, staffFree: 0 },
      SNACK: { students: 0, staff: 0, staffFree: 0 },
    })
  })
})
