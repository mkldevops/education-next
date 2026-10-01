import { describe, expect, it } from 'vitest'
import { deriveStudentDetail, type StudentDetail } from './student-detail'

const link = (familyId: string, relationType: 'PARENT' | 'TUTOR', name: string) => ({
  familyId,
  relationType,
  family: { id: familyId, name, languagesAtHome: [name.toLowerCase()] },
})

const studentWith = (families: ReturnType<typeof link>[]) =>
  ({
    birthday: null,
    person: { name: 'Léo', lastname: 'Martin', families },
    enrollments: [],
  }) as unknown as StudentDetail

describe('deriveStudentDetail', () => {
  it('shows the debtor family whatever order the database returned the links in', () => {
    const detail = deriveStudentDetail(
      studentWith([link('family-b', 'TUTOR', 'Tutor'), link('family-a', 'PARENT', 'Parent')])
    )

    expect(detail.family?.id).toBe('family-a')
    expect(detail.languagesAtHome).toBe('parent')
  })

  it('breaks a tie on the lowest familyId so two admins see the same family', () => {
    const forward = deriveStudentDetail(
      studentWith([link('family-a', 'PARENT', 'A'), link('family-b', 'PARENT', 'B')])
    )
    const reversed = deriveStudentDetail(
      studentWith([link('family-b', 'PARENT', 'B'), link('family-a', 'PARENT', 'A')])
    )

    expect(forward.family?.id).toBe('family-a')
    expect(reversed.family?.id).toBe('family-a')
  })

  it('shows no family when the reader may see none of the links', () => {
    const detail = deriveStudentDetail(studentWith([]))

    expect(detail.family).toBeNull()
    expect(detail.languagesAtHome).toBe('')
  })
})
