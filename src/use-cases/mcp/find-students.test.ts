import { describe, expect, it, vi } from 'vitest'
import { findStudentsFromMcp } from './find-students'

const row = {
  id: 'student-1',
  person: {
    name: 'Ali',
    lastname: 'Madi',
    families: [{ family: { id: 'family-1', name: 'Madi' } }],
  },
  enrollments: [
    {
      id: 'enr-1',
      status: 'ACTIVE',
      plan: { id: 'plan-1', name: 'Annuel' },
      classAssignments: [{ classPeriod: { id: 'cp-1', name: 'CP A' } }],
    },
  ],
}

describe('findStudentsFromMcp', () => {
  it('flattens the student, its families and its open enrollments with their class', async () => {
    const findStudents = vi.fn().mockResolvedValue([row])

    const result = await findStudentsFromMcp({ schoolId: 'school-1' }, { query: 'ali madi' }, {
      findStudents,
    } as never)

    expect(findStudents).toHaveBeenCalledWith('school-1', 'ali madi', 10)
    expect(result).toEqual([
      {
        id: 'student-1',
        name: 'Ali',
        lastname: 'Madi',
        families: [{ id: 'family-1', name: 'Madi' }],
        enrollments: [
          {
            id: 'enr-1',
            status: 'ACTIVE',
            plan: { id: 'plan-1', name: 'Annuel' },
            classes: [{ id: 'cp-1', name: 'CP A' }],
          },
        ],
      },
    ])
  })

  it('rejects a one-letter query', async () => {
    const findStudents = vi.fn()

    expect(
      await findStudentsFromMcp({ schoolId: 'school-1' }, { query: 'a' }, { findStudents } as never)
    ).toBe('validationError')
    expect(findStudents).not.toHaveBeenCalled()
  })
})
