import { describe, expect, it } from 'vitest'
import { formatDate, formatDateLong, formatDateTime } from '../date'

const VALUE = '2026-03-09T14:05:00.000Z'

describe('date formatting', () => {
  it('follows the locale for the short form', () => {
    expect(formatDate(VALUE, 'fr-FR')).toBe('09/03/2026')
    expect(formatDate(VALUE, 'en-US')).toBe('3/9/2026')
  })

  it('accepts a Date, a string or a timestamp', () => {
    const expected = formatDate(VALUE, 'fr-FR')

    expect(formatDate(new Date(VALUE), 'fr-FR')).toBe(expected)
    expect(formatDate(Date.parse(VALUE), 'fr-FR')).toBe(expected)
  })

  it('spells the month out in the long form', () => {
    expect(formatDateLong(VALUE, 'fr-FR')).toMatch(/^09 mars 2026$/)
  })

  it('keeps date and time together in the timestamp form', () => {
    expect(formatDateTime(VALUE, 'fr-FR')).toContain('2026')
    expect(formatDateTime(VALUE, 'fr-FR')).toMatch(/\d{2}:\d{2}/)
  })
})
