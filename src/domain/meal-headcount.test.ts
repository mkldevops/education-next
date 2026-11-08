import { describe, expect, it } from 'vitest'
import { mealHeadcount } from './meal-headcount'

const monday = '2026-11-02'
const segment = {
  accountId: 'a1',
  staff: null,
  weekdays: [1, 2, 3, 4],
  startOn: '2026-09-01',
  endOn: null,
  periodEnd: '2027-06-30',
}

function count(input: Partial<Parameters<typeof mealHeadcount>[0]> = {}) {
  return mealHeadcount({
    day: monday,
    isClosed: false,
    segments: [segment],
    absentAccountIds: new Set(),
    ...input,
  })
}

describe('mealHeadcount', () => {
  it('counts students and staff separately, exempt staff apart', () => {
    expect(
      count({
        segments: [
          segment,
          { ...segment, accountId: 'a2' },
          { ...segment, accountId: 's1', staff: { exempt: false }, weekdays: [1, 4] },
          { ...segment, accountId: 's2', staff: { exempt: true }, weekdays: [1] },
          { ...segment, accountId: 's3', staff: { exempt: false }, weekdays: [3] },
        ],
      })
    ).toEqual({ students: 2, staff: 2, staffFree: 1 })
  })

  it('skips an absence, another weekday and a segment outside the day', () => {
    expect(
      count({
        segments: [
          segment,
          { ...segment, accountId: 'a2', weekdays: [3] },
          { ...segment, accountId: 'a3', startOn: '2026-11-03' },
          { ...segment, accountId: 'a4', endOn: '2026-10-30' },
          { ...segment, accountId: 'a5', periodEnd: '2026-10-31' },
          { ...segment, accountId: 's1', staff: { exempt: false } },
        ],
        absentAccountIds: new Set(['a1', 's1']),
      })
    ).toEqual({ students: 0, staff: 0, staffFree: 0 })
  })

  it('serves nobody on a closed day', () => {
    expect(
      count({
        isClosed: true,
        segments: [segment, { ...segment, accountId: 's1', staff: { exempt: true } }],
      })
    ).toEqual({ students: 0, staff: 0, staffFree: 0 })
  })
})
