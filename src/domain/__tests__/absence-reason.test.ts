import { describe, expect, it } from 'vitest'
import {
  countMissingAbsenceReasons,
  normalizeAbsenceReasonLabel,
  sameAbsenceReasonLabel,
} from '../absence-reason'
import { readAttendanceEntryMode } from '../attendance-entry-mode'

describe('absence reason labels', () => {
  it('collapses surrounding and inner whitespace', () => {
    expect(normalizeAbsenceReasonLabel('  Rendez-vous   médical ')).toBe('Rendez-vous médical')
  })

  it('compares labels ignoring case and extra spaces', () => {
    expect(sameAbsenceReasonLabel('MALADIE ', 'maladie')).toBe(true)
    expect(sameAbsenceReasonLabel('Maladie', 'Malade')).toBe(false)
  })
})

describe('countMissingAbsenceReasons', () => {
  it('counts only absences without a reason', () => {
    expect(
      countMissingAbsenceReasons([
        { status: 'ABSENT', absenceReasonId: null },
        { status: 'ABSENT', absenceReasonId: 'r1' },
        { status: 'LATE', absenceReasonId: null },
        { status: 'PRESENT', absenceReasonId: null },
      ])
    ).toBe(1)
  })
})

describe('readAttendanceEntryMode', () => {
  it.each([
    [null, 'LIST'],
    [undefined, 'LIST'],
    ['LIST', 'LIST'],
    ['ONE_BY_ONE', 'ONE_BY_ONE'],
    ['other', 'LIST'],
  ])('reads %j as %s', (value, mode) => {
    expect(readAttendanceEntryMode(value)).toBe(mode)
  })
})
