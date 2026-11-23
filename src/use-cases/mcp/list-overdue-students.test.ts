import { describe, expect, it, vi } from 'vitest'
import { listOverdueStudentsFromMcp } from './list-overdue-students'

const scope = {
  owner: { kind: 'ADMIN_SESSION' as const, userId: 'user-1' },
  userId: 'user-1',
  schoolId: 'school-1',
  paymentsEnabled: true,
}

function row(studentId: string, familyId: string, overdueAmount: number) {
  return {
    studentId,
    personId: `person-${studentId}`,
    name: studentId,
    lastname: 'Madi',
    classes: [],
    family: { id: familyId, name: familyId, overdueAmount, expectedToDate: 0, paidToDate: 0 },
  }
}

const settings = vi.fn().mockResolvedValue({ currency: 'KMF', timeZone: 'Indian/Comoro' })

describe('listOverdueStudentsFromMcp', () => {
  it('counts each overdue family once in the total', async () => {
    const overdueStudents = vi
      .fn()
      .mockResolvedValue([
        row('s-1', 'f-1', 100.1),
        row('s-2', 'f-1', 100.1),
        row('s-3', 'f-2', 50.2),
      ])

    expect(
      await listOverdueStudentsFromMcp(scope as never, overdueStudents, settings)
    ).toMatchObject({
      currency: 'KMF',
      total: 3,
      families: 2,
      totalOverdueAmount: 150.3,
    })
    expect(overdueStudents).toHaveBeenCalledWith('school-1')
    expect(settings).toHaveBeenCalledWith('school-1')
  })

  it('refuses when payments are disabled', async () => {
    const overdueStudents = vi.fn()

    expect(
      await listOverdueStudentsFromMcp(
        { ...scope, paymentsEnabled: false } as never,
        overdueStudents,
        settings
      )
    ).toBe('paymentsDisabled')
    expect(overdueStudents).not.toHaveBeenCalled()
  })
})
