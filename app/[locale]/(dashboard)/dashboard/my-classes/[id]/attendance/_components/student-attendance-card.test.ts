import { describe, expect, it, vi } from 'vitest'

vi.mock('@peaklab/ui', () => ({ Button: () => null }))

import { clampLateMinutes, parseLateMinutes } from './student-attendance-card'

describe('parseLateMinutes', () => {
  it.each([
    ['', null],
    ['  ', null],
    ['0', 0],
    ['15', 15],
    ['1440', 1440],
  ])('accepts %j as %j', (value, expected) => {
    expect(parseLateMinutes(value)).toBe(expected)
  })

  it.each(['-3', '1441', '2.5', 'abc'])('rejects %j', (value) => {
    expect(parseLateMinutes(value)).toBe('invalid')
  })
})

describe('clampLateMinutes', () => {
  it.each([
    ['-3', 0],
    ['2000', 1440],
    ['2.6', 3],
    ['', null],
    ['abc', null],
  ])('brings %j back to %j', (value, expected) => {
    expect(clampLateMinutes(value)).toBe(expected)
  })
})
