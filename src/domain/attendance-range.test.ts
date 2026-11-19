import { describe, expect, it } from 'vitest'
import { ATTENDANCE_RANGE_MAX_DAYS, resolveAttendanceRange } from './attendance-range'

const today = new Date('2026-11-19T00:00:00.000Z')
const day = (date: Date) => date.toISOString().slice(0, 10)
const resolve = (input: Parameters<typeof resolveAttendanceRange>[0]) => {
  const range = resolveAttendanceRange(input, today)
  return { preset: range.preset, from: day(range.from), to: day(range.to) }
}

describe('resolveAttendanceRange', () => {
  it('includes today in rolling presets', () => {
    expect(resolve({ range: 'last15' })).toEqual({
      preset: 'last15',
      from: '2026-11-05',
      to: '2026-11-19',
    })
    expect(resolve({ range: 'last30' })).toEqual({
      preset: 'last30',
      from: '2026-10-21',
      to: '2026-11-19',
    })
    expect(resolve({ range: 'last60' })).toEqual({
      preset: 'last60',
      from: '2026-09-21',
      to: '2026-11-19',
    })
  })

  it('starts the current month on its first day', () => {
    expect(resolve({ range: 'month' })).toEqual({
      preset: 'month',
      from: '2026-11-01',
      to: '2026-11-19',
    })
  })

  it('falls back to the last 30 days for a missing or unknown range', () => {
    expect(resolve({}).preset).toBe('last30')
    expect(resolve({ range: 'year' }).preset).toBe('last30')
    expect(resolve({ range: 'custom', from: '2026-02-30', to: '2026-11-01' }).preset).toBe('last30')
    expect(resolve({ range: 'custom', from: '2026-11-01' }).preset).toBe('last30')
  })

  it('orders reversed custom bounds', () => {
    expect(resolve({ range: 'custom', from: '2026-11-10', to: '2026-11-01' })).toEqual({
      preset: 'custom',
      from: '2026-11-01',
      to: '2026-11-10',
    })
  })

  it('shortens a custom range that exceeds the maximum from its start', () => {
    const range = resolveAttendanceRange(
      { range: 'custom', from: '2026-01-01', to: '2026-11-19' },
      today
    )
    expect(day(range.to)).toBe('2026-11-19')
    expect((range.to.getTime() - range.from.getTime()) / 86_400_000).toBe(
      ATTENDANCE_RANGE_MAX_DAYS - 1
    )
  })
})
