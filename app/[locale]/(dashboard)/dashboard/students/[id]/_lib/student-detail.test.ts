import { describe, expect, it } from 'vitest'
import { deriveStudentDetail, type StudentDetail } from './student-detail'

const link = (familyId: string, relationType: 'PARENT' | 'TUTOR', name: string) => ({
  familyId,
  relationType,
  family: { id: familyId, name, languagesAtHome: [name.toLowerCase()] },
})

const regional = { currency: 'EUR', timeZone: 'Europe/Paris' }

const studentWith = (
  families: ReturnType<typeof link>[],
  extra: { isActive?: boolean; leftAt?: Date | null; enrollments?: unknown[] } = {}
) =>
  ({
    birthday: null,
    isActive: true,
    leftAt: null,
    person: { name: 'Léo', lastname: 'Martin', families },
    enrollments: [],
    ...extra,
  }) as unknown as StudentDetail

// Monthly Sep→Jun, 100 per month, 1000 for the year.
const yearEnrollment = (overrides: Record<string, unknown> = {}) => ({
  id: 'enrollment-1',
  status: 'ACTIVE',
  totalAmount: 1000,
  discount: 0,
  startMonth: null,
  endMonth: null,
  plan: { paymentSchedule: { mode: 'MONTHLY', firstMonth: 9, count: 10, dueDay: 10 } },
  classAssignments: [
    {
      startAt: new Date('2026-09-01T00:00:00Z'),
      classPeriod: { period: { startAt: new Date('2026-09-01T00:00:00Z') } },
    },
  ],
  payments: [{ amount: 150 }],
  ...overrides,
})

describe('deriveStudentDetail', () => {
  it('shows the debtor family whatever order the database returned the links in', () => {
    const detail = deriveStudentDetail(
      studentWith([link('family-b', 'TUTOR', 'Tutor'), link('family-a', 'PARENT', 'Parent')]),
      regional
    )

    expect(detail.family?.id).toBe('family-a')
    expect(detail.languagesAtHome).toBe('parent')
  })

  it('breaks a tie on the lowest familyId so two admins see the same family', () => {
    const forward = deriveStudentDetail(
      studentWith([link('family-a', 'PARENT', 'A'), link('family-b', 'PARENT', 'B')]),
      regional
    )
    const reversed = deriveStudentDetail(
      studentWith([link('family-b', 'PARENT', 'B'), link('family-a', 'PARENT', 'A')]),
      regional
    )

    expect(forward.family?.id).toBe('family-a')
    expect(reversed.family?.id).toBe('family-a')
  })

  it('shows no family when the reader may see none of the links', () => {
    const detail = deriveStudentDetail(studentWith([]), regional)

    expect(detail.family).toBeNull()
    expect(detail.languagesAtHome).toBe('')
  })

  it('stops a student archived the old way at his departure month', () => {
    const detail = deriveStudentDetail(
      studentWith([], {
        isActive: false,
        leftAt: new Date('2026-10-20T10:00:00Z'),
        enrollments: [yearEnrollment()],
      }),
      regional
    )

    // Sep + Oct owed (200), 150 paid: 50 left, not the 850 of the whole year.
    expect(detail.totalDue).toBe(200)
    expect(detail.remaining).toBe(50)
    expect(detail.payableRemaining).toBe(50)
    expect(detail.enrollments[0]?.endMonth).toEqual(new Date('2026-10-01T00:00:00.000Z'))
  })

  it('keeps what an old-way archived student already paid beyond his departure', () => {
    const detail = deriveStudentDetail(
      studentWith([], {
        isActive: false,
        leftAt: new Date('2026-09-15T10:00:00Z'),
        enrollments: [yearEnrollment({ payments: [{ amount: 300 }] })],
      }),
      regional
    )

    expect(detail.totalDue).toBe(300)
    expect(detail.remaining).toBe(0)
  })

  it('leaves the full year to an active student', () => {
    const detail = deriveStudentDetail(
      studentWith([], { enrollments: [yearEnrollment()] }),
      regional
    )

    expect(detail.totalDue).toBe(1000)
    expect(detail.remaining).toBe(850)
  })
})
