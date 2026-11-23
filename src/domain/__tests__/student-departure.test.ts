import { describe, expect, it } from 'vitest'
import {
  defaultDepartureMonth,
  departureMonths,
  departureSettlement,
  legacyDepartureMonth,
  legacyDepartureTotal,
} from '@/domain/student-departure'

const period = {
  startAt: new Date('2026-09-01T00:00:00.000Z'),
  endAt: new Date('2027-06-30T00:00:00.000Z'),
}

describe('departureMonths', () => {
  it('spans the open enrollment periods, across the new year', () => {
    const months = departureMonths([period], '2026-11')
    expect(months[0]).toBe('2026-09')
    expect(months).toContain('2027-01')
    expect(months.at(-1)).toBe('2027-06')
    expect(months).toHaveLength(10)
  })

  it('offers the current month only without any period', () => {
    expect(departureMonths([], '2026-11')).toEqual(['2026-11'])
  })
})

describe('defaultDepartureMonth', () => {
  const months = departureMonths([period], '2026-11')

  it('is the current school month, brought back inside the period', () => {
    expect(defaultDepartureMonth(months, '2026-11')).toBe('2026-11')
    expect(defaultDepartureMonth(months, '2026-07')).toBe('2026-09')
    expect(defaultDepartureMonth(months, '2027-08')).toBe('2027-06')
  })
})

describe('departureSettlement', () => {
  it('keeps the remainder owed', () => {
    expect(departureSettlement(400, 150, 'keep')).toEqual({
      totalAmount: 400,
      writeOffAmount: null,
    })
  })

  it('writes the remainder off down to what was paid', () => {
    expect(departureSettlement(400, 150, 'writeOff')).toEqual({
      totalAmount: 150,
      writeOffAmount: 250,
    })
  })

  it('never turns a payment beyond the amount owed into a credit', () => {
    expect(departureSettlement(400, 500, 'keep').totalAmount).toBe(500)
    expect(departureSettlement(400, 500, 'writeOff')).toEqual({
      totalAmount: 500,
      writeOffAmount: 0,
    })
  })
})

describe('legacyDepartureMonth', () => {
  const left = { isActive: false, leftAt: new Date('2026-10-31T23:30:00.000Z') }
  const open = { status: 'ACTIVE' as const, endMonth: null }

  it('reads the departure month of a student archived before enrollments were closed', () => {
    // 23:30 UTC on Oct 31 is already November in Paris.
    expect(legacyDepartureMonth(left, open, 'Europe/Paris')).toBe('2026-11')
    expect(legacyDepartureMonth(left, { ...open, status: 'PENDING' }, 'UTC')).toBe('2026-10')
  })

  it('leaves alone active students, closed enrollments and archives without a date', () => {
    expect(legacyDepartureMonth({ ...left, isActive: true }, open, 'UTC')).toBeNull()
    expect(legacyDepartureMonth({ ...left, leftAt: null }, open, 'UTC')).toBeNull()
    expect(
      legacyDepartureMonth(left, { ...open, endMonth: new Date('2026-10-01T00:00:00Z') }, 'UTC')
    ).toBeNull()
    expect(legacyDepartureMonth(left, { ...open, status: 'COMPLETED' }, 'UTC')).toBeNull()
  })
})

describe('legacyDepartureTotal', () => {
  const enrollment = {
    schedule: { mode: 'MONTHLY' as const, firstMonth: 9, count: 10, dueDay: 10 },
    totalAmount: 1000,
    periodStart: new Date('2026-09-01T00:00:00.000Z'),
    startMonth: null,
    firstInstallmentAmount: null,
  }

  it('owes the deadlines through the departure month, or what was already paid', () => {
    expect(legacyDepartureTotal(enrollment, '2026-10', 150, 'EUR')).toBe(200)
    expect(legacyDepartureTotal(enrollment, '2026-10', 300, 'EUR')).toBe(300)
  })

  it('follows a reduced first installment', () => {
    // Joined in October at 50 instead of 100: 50 + 100 are due through November.
    const arrival = {
      ...enrollment,
      totalAmount: 850,
      startMonth: '2026-10',
      firstInstallmentAmount: 50,
    }
    expect(legacyDepartureTotal(arrival, '2026-11', 0, 'EUR')).toBe(150)
  })

  it('keeps the whole total when nothing schedules it', () => {
    expect(
      legacyDepartureTotal({ ...enrollment, schedule: { mode: 'NONE' } }, '2026-10', 0, 'EUR')
    ).toBe(1000)
    expect(legacyDepartureTotal({ ...enrollment, periodStart: null }, '2026-10', 0, 'EUR')).toBe(
      1000
    )
  })
})
