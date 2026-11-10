import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = { student: { findMany: vi.fn() } }
vi.mock('@/lib/db', () => ({ db: dbMock }))

const { getOverdueStudents } = await import('./overdue-students')

function family(familyId: string, familyName: string, overdueAmount: number) {
  return {
    familyId,
    familyName,
    overdueAmount,
    expectedToDate: 300,
    paidToDate: 100,
    tracked: true,
  }
}

function student(
  id: string,
  name: string,
  families: { familyId: string; relationType: 'PARENT' | 'TUTOR' }[],
  classes: { id: string; name: string }[] = []
) {
  return {
    id,
    person: { id: `person-${id}`, name, lastname: 'Madi', families },
    enrollments: [{ classAssignments: classes.map((classPeriod) => ({ classPeriod })) }],
  }
}

describe('getOverdueStudents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the children of overdue families with their class, largest arrears first', async () => {
    const tracking = vi
      .fn()
      .mockResolvedValue([
        family('family-1', 'Madi', 50),
        family('family-2', 'Said', 200),
        family('family-3', 'Ali', 0),
      ])
    dbMock.student.findMany.mockResolvedValue([
      student(
        's-1',
        'Ali',
        [{ familyId: 'family-1', relationType: 'PARENT' }],
        [{ id: 'cp-1', name: 'CP' }]
      ),
      student('s-2', 'Nour', [{ familyId: 'family-2', relationType: 'PARENT' }]),
    ])

    const result = await getOverdueStudents('school-1', { periodId: 'period-1', tracking })

    expect(tracking).toHaveBeenCalledWith('school-1', {
      periodId: 'period-1',
      reference: undefined,
    })
    expect(dbMock.student.findMany.mock.calls[0][0].where).toMatchObject({
      schoolId: 'school-1',
      person: { families: { some: { familyId: { in: ['family-1', 'family-2'] } } } },
    })
    expect(result.map((row) => [row.studentId, row.family.overdueAmount])).toEqual([
      ['s-2', 200],
      ['s-1', 50],
    ])
    expect(result[1]).toMatchObject({
      personId: 'person-s-1',
      classes: [{ id: 'cp-1', name: 'CP' }],
      family: { id: 'family-1', name: 'Madi', expectedToDate: 300, paidToDate: 100 },
    })
  })

  it('skips a child whose debt belongs to another, non-overdue family', async () => {
    const tracking = vi.fn().mockResolvedValue([family('family-2', 'Said', 80)])
    dbMock.student.findMany.mockResolvedValue([
      student('s-1', 'Ali', [
        { familyId: 'family-1', relationType: 'PARENT' },
        { familyId: 'family-2', relationType: 'TUTOR' },
      ]),
    ])

    expect(await getOverdueStudents('school-1', { tracking })).toEqual([])
  })

  it('does not query students when no family is overdue', async () => {
    const tracking = vi.fn().mockResolvedValue([family('family-1', 'Madi', 0)])

    expect(await getOverdueStudents('school-1', { tracking })).toEqual([])
    expect(dbMock.student.findMany).not.toHaveBeenCalled()
  })
})
