import { describe, expect, it } from 'vitest'
import {
  attendanceRosterWindow,
  canRefreshRoster,
  missingRosterStudents,
  planCancellationTransition,
} from './attendance-session'

describe('attendanceRosterWindow', () => {
  it('covers the whole UTC calendar day of the occurrence', () => {
    expect(attendanceRosterWindow(new Date('2026-01-05T00:00:00.000Z'))).toEqual({
      startsBefore: new Date('2026-01-06T00:00:00.000Z'),
      endsFrom: new Date('2026-01-05T00:00:00.000Z'),
    })
  })

  it('includes an assignment timestamped during the day and excludes the next day', () => {
    const { startsBefore } = attendanceRosterWindow(new Date('2026-01-05T00:00:00.000Z'))
    expect(new Date('2026-01-05T09:00:00.000Z') < startsBefore).toBe(true)
    expect(new Date('2026-01-05T23:59:59.999Z') < startsBefore).toBe(true)
    expect(new Date('2026-01-06T00:00:00.000Z') < startsBefore).toBe(false)
  })
})

describe('missingRosterStudents', () => {
  it('keeps only students without an entry, once each', () => {
    const roster = [
      { studentId: 'a', studentName: 'A' },
      { studentId: 'b', studentName: 'B' },
      { studentId: 'b', studentName: 'B' },
      { studentId: 'c', studentName: 'C' },
    ]
    expect(missingRosterStudents(roster, ['a']).map(({ studentId }) => studentId)).toEqual([
      'b',
      'c',
    ])
  })
})

describe('canRefreshRoster', () => {
  it('only allows a draft session', () => {
    expect(canRefreshRoster('DRAFT')).toBe(true)
    expect(canRefreshRoster('VALIDATED')).toBe(false)
    expect(canRefreshRoster('CANCELLED')).toBe(false)
  })
})

describe('planCancellationTransition', () => {
  const session = (
    status: 'DRAFT' | 'VALIDATED' | 'CANCELLED',
    statusBeforeCancellation: 'DRAFT' | 'VALIDATED' | null = null,
    entryCount = 2
  ) => ({ status, statusBeforeCancellation, entryCount })

  it('cancels an active session and remembers its status', () => {
    expect(planCancellationTransition(session('VALIDATED'), true)).toEqual({
      kind: 'cancel',
      from: 'VALIDATED',
    })
  })

  it('treats cancelling an already cancelled session as unchanged', () => {
    expect(planCancellationTransition(session('CANCELLED', 'DRAFT'), true)).toEqual({
      kind: 'unchanged',
    })
  })

  it.each(['DRAFT', 'VALIDATED'] as const)('refuses restoring a %s session', (status) => {
    expect(planCancellationTransition(session(status), false)).toEqual({
      kind: 'invalidTransition',
    })
  })

  it('restores the saved status, defaulting to draft', () => {
    expect(planCancellationTransition(session('CANCELLED', 'VALIDATED'), false)).toEqual({
      kind: 'restore',
      to: 'VALIDATED',
    })
    expect(planCancellationTransition(session('CANCELLED', null, 3), false)).toEqual({
      kind: 'restore',
      to: 'DRAFT',
    })
  })

  it('deletes an empty cancelled placeholder on restore', () => {
    expect(planCancellationTransition(session('CANCELLED', null, 0), false)).toEqual({
      kind: 'deletePlaceholder',
    })
  })
})
