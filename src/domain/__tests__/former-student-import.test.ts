import { describe, expect, it } from 'vitest'
import {
  capFormerStudentRows,
  classifyFormerStudents,
  countFormerStudentStatuses,
  type ExistingStudent,
  FORMER_STUDENT_IMPORT_LIMITS,
  type FormerStudentDraft,
  formerClassLabel,
  formerStudentLeftAt,
  isImportable,
  isValidBirthday,
  isValidDepartureYear,
} from '@/domain/former-student-import'

const now = new Date('2026-11-19T10:00:00.000Z')

const draft = (overrides: Partial<FormerStudentDraft> = {}): FormerStudentDraft => ({
  id: overrides.id ?? 'r1',
  lastname: 'Durand',
  firstname: 'Léa',
  birthday: '',
  className: 'CM2',
  departureYear: '2023',
  included: true,
  uncertain: [],
  ...overrides,
})

const student = (overrides: Partial<ExistingStudent> = {}): ExistingStudent => ({
  lastname: 'Durand',
  firstname: 'Léa',
  birthday: null,
  isActive: false,
  ...overrides,
})

const statusOf = (rows: FormerStudentDraft[], existing: ExistingStudent[] = []) =>
  classifyFormerStudents(rows, existing, now).map((row) => row.status)

describe('classifyFormerStudents', () => {
  it('creates an unknown student', () => {
    expect(statusOf([draft()])).toEqual(['create'])
  })

  it('skips an archived student of the same name, whatever the case, accents and spaces', () => {
    expect(statusOf([draft({ lastname: ' DURAND ', firstname: 'lea' })], [student()])).toEqual([
      'existing',
    ])
  })

  it('skips an archived match when both birthdays are equal', () => {
    const rows = [draft({ birthday: '2012-03-04' })]
    expect(statusOf(rows, [student({ birthday: '2012-03-04' })])).toEqual(['existing'])
  })

  it('flags an archived namesake born on another day as a homonym', () => {
    const rows = [draft({ birthday: '2012-03-04' })]
    expect(statusOf(rows, [student({ birthday: '2011-01-01' })])).toEqual(['homonym'])
  })

  it('skips an active student only when both birthdays are known and equal', () => {
    const active = student({ isActive: true, birthday: '2012-03-04' })
    expect(statusOf([draft({ birthday: '2012-03-04' })], [active])).toEqual(['existing'])
  })

  it('flags an active namesake with a different or unknown birthday as a homonym', () => {
    const active = student({ isActive: true, birthday: '2012-03-04' })
    expect(statusOf([draft({ birthday: '2010-05-06' })], [active])).toEqual(['homonym'])
    expect(statusOf([draft()], [active])).toEqual(['homonym'])
    expect(statusOf([draft({ birthday: '2012-03-04' })], [student({ isActive: true })])).toEqual([
      'homonym',
    ])
  })

  it('marks a missing name as incomplete', () => {
    const result = classifyFormerStudents([draft({ firstname: '  ' })], [], now)
    expect(result[0]).toEqual({ id: 'r1', status: 'incomplete', issues: ['missingName'] })
  })

  it.each(['2012-02-30', '2012-13-01', '04/03/2012', '1899-12-31', '2027-01-01'])(
    'marks the invalid birthday %s as incomplete',
    (birthday) => {
      const result = classifyFormerStudents([draft({ birthday })], [], now)
      expect(result[0]?.issues).toEqual(['invalidBirthday'])
    }
  )

  it.each(['23', '1949', '2027', 'abcd'])('marks the invalid year %s as incomplete', (year) => {
    const result = classifyFormerStudents([draft({ departureYear: year })], [], now)
    expect(result[0]?.issues).toEqual(['invalidYear'])
  })

  it('marks a class label over 100 characters as incomplete', () => {
    const result = classifyFormerStudents([draft({ className: 'x'.repeat(101) })], [], now)
    expect(result[0]?.issues).toEqual(['classTooLong'])
  })

  it('keeps one row of an in-file duplicate', () => {
    const result = classifyFormerStudents([draft({ id: 'a' }), draft({ id: 'b' })], [], now)
    expect(result.map((row) => row.status)).toEqual(['create', 'existing'])
    expect(result[1]?.issues).toEqual(['duplicateInFile'])
  })

  it('keeps two namesakes of the file born on different days', () => {
    const rows = [
      draft({ id: 'a', birthday: '2012-03-04' }),
      draft({ id: 'b', birthday: '2013-03-04' }),
    ]
    expect(statusOf(rows)).toEqual(['create', 'create'])
  })

  it('ignores an excluded row when looking for in-file duplicates', () => {
    const rows = [draft({ id: 'a', included: false }), draft({ id: 'b' })]
    expect(statusOf(rows)).toEqual(['create', 'create'])
  })

  it('is idempotent: rows already imported as archived students are all skipped', () => {
    const rows = [
      draft({ id: 'a' }),
      draft({ id: 'b', lastname: 'Martin', firstname: 'Hugo', birthday: '2014-02-01' }),
    ]
    const imported = rows.map((row) =>
      student({
        lastname: row.lastname,
        firstname: row.firstname,
        birthday: row.birthday || null,
      })
    )
    expect(statusOf(rows, imported)).toEqual(['existing', 'existing'])
  })
})

describe('counts and importable rows', () => {
  it('counts only included rows and never imports incomplete or existing ones', () => {
    const rows = [
      draft({ id: 'a' }),
      draft({ id: 'b', lastname: 'Martin' }),
      draft({ id: 'c', lastname: '' }),
      draft({ id: 'd', lastname: 'Petit', included: false }),
    ]
    const preview = classifyFormerStudents(rows, [student({ lastname: 'Martin' })], now)
    expect(countFormerStudentStatuses(rows, preview)).toEqual({
      create: 1,
      existing: 1,
      homonym: 0,
      incomplete: 1,
    })
    const importable = rows.filter((row, index) => {
      const entry = preview[index]
      return entry ? isImportable(row, entry) : false
    })
    expect(importable.map((row) => row.id)).toEqual(['a'])
  })
})

describe('dates', () => {
  it('validates birthdays and departure years', () => {
    expect(isValidBirthday('2012-02-29', now)).toBe(true)
    expect(isValidBirthday('2013-02-29', now)).toBe(false)
    expect(isValidDepartureYear('2026', now)).toBe(true)
    expect(isValidDepartureYear('2027', now)).toBe(false)
  })

  it('sets the departure on 31 August of the year, or now without a year', () => {
    expect(formerStudentLeftAt('2023', now).toISOString()).toBe('2023-08-31T00:00:00.000Z')
    expect(formerStudentLeftAt('', now)).toBe(now)
  })

  it('never sets a departure in the future', () => {
    const july = new Date('2026-07-01T00:00:00.000Z')
    expect(formerStudentLeftAt('2026', july)).toBe(july)
  })
})

describe('helpers', () => {
  it('caps a reading at 500 rows', () => {
    const rows = Array.from({ length: FORMER_STUDENT_IMPORT_LIMITS.maxRows + 3 }, (_, i) => i)
    const capped = capFormerStudentRows(rows)
    expect(capped.rows).toHaveLength(500)
    expect(capped.truncated).toBe(true)
    expect(capFormerStudentRows([1, 2]).truncated).toBe(false)
  })

  it('normalizes the class label', () => {
    expect(formerClassLabel('  CM2   A ')).toBe('CM2 A')
    expect(formerClassLabel('   ')).toBeNull()
  })
})
