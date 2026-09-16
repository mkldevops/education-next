import { expect, it } from 'vitest'
import { attendanceUtcDate } from './attendance-date'

it('accepts only valid ISO calendar dates', () => {
  const fallback = new Date('2026-01-01T00:00:00.000Z')
  expect(attendanceUtcDate('2026-02-30', fallback)).toBe(fallback)
  expect(attendanceUtcDate('2026-01-05', fallback).toISOString()).toBe('2026-01-05T00:00:00.000Z')
})
