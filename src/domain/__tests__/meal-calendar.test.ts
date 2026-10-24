import { describe, expect, it } from 'vitest'
import { mealCalendar } from '../meal-calendar'
import { servedDays } from '../meal-ledger'

// Lundi, mardi, jeudi du lundi 2 au jeudi 12 novembre ; mercredi 4 et jeudi 5 fermés.
const segments = [
  { weekdays: [1, 2, 4], startOn: '2026-11-02', endOn: '2026-11-12', periodEnd: '2027-06-30' },
]
const closed = new Set(['2026-11-04', '2026-11-05'])
const isClosed = (day: string) => closed.has(day)

function calendar(absences: string[], ownedDays: number, today: string) {
  const absent = new Set(absences)
  const served = servedDays({ segments, periodEnd: '2027-06-30', isClosed, absences: absent })
  return mealCalendar({ segments, isClosed, absences: absent, served, ownedDays, today })
}

describe('mealCalendar', () => {
  it('marks covered days paid, past uncovered days due and future ones unpaid', () => {
    expect(calendar([], 2, '2026-11-09')).toEqual([
      { day: '2026-11-02', status: 'paid' },
      { day: '2026-11-03', status: 'paid' },
      { day: '2026-11-05', status: 'closed' },
      { day: '2026-11-09', status: 'due' },
      { day: '2026-11-10', status: 'unpaid' },
      { day: '2026-11-12', status: 'unpaid' },
    ])
  })

  it('lets coverage slide past an absence', () => {
    const days = calendar(['2026-11-03'], 2, '2026-11-09')

    expect(days.find((d) => d.day === '2026-11-03')?.status).toBe('absent')
    expect(days.find((d) => d.day === '2026-11-09')?.status).toBe('paid')
  })

  it('treats a negative balance as nothing paid', () => {
    expect(calendar([], -1, '2026-11-02')[0]).toEqual({ day: '2026-11-02', status: 'due' })
  })
})
