import { describe, expect, it, vi } from 'vitest'
import { moveStudentToClassFromMcp } from './move-student-to-class'

const ENROLLMENT = '11111111-1111-4111-8111-111111111111'
const CLASS = '22222222-2222-4222-8222-222222222222'
const scope = { schoolId: 'school-1' }

function deps(reassignResult: unknown = 'OK', candidates: Array<{ id: string }> = []) {
  return {
    reassign: vi.fn().mockResolvedValue(reassignResult),
    findOpen: vi.fn().mockResolvedValue(candidates),
  }
}

describe('moveStudentToClassFromMcp', () => {
  it('moves the designated enrollment through the dashboard use case, in the scope school', async () => {
    const d = deps()

    const result = await moveStudentToClassFromMcp(
      scope,
      { enrollmentId: ENROLLMENT, classPeriodId: CLASS, schoolId: 'other' } as never,
      d
    )

    expect(d.findOpen).not.toHaveBeenCalled()
    expect(d.reassign).toHaveBeenCalledWith({
      schoolId: 'school-1',
      enrollmentId: ENROLLMENT,
      newClassPeriodId: CLASS,
    })
    expect(result).toEqual({ enrollmentId: ENROLLMENT, classPeriodId: CLASS })
  })

  it("finds the student's only open enrollment by name", async () => {
    const d = deps('OK', [{ id: ENROLLMENT }])

    const result = await moveStudentToClassFromMcp(
      scope,
      { studentName: 'Houmaira', studentLastname: 'Cheikh Ahmed Ibrahim', classPeriodId: CLASS },
      d
    )

    expect(d.findOpen).toHaveBeenCalledWith('school-1', {
      name: 'Houmaira',
      lastname: 'Cheikh Ahmed Ibrahim',
    })
    expect(d.reassign).toHaveBeenCalledWith({
      schoolId: 'school-1',
      enrollmentId: ENROLLMENT,
      newClassPeriodId: CLASS,
    })
    expect(result).toEqual({ enrollmentId: ENROLLMENT, classPeriodId: CLASS })
  })

  it('refuses a name that matches no open enrollment, or several', async () => {
    const none = deps('OK', [])
    const several = deps('OK', [{ id: 'a' }, { id: 'b' }])
    const input = { studentName: 'Sara', studentLastname: 'Diallo', classPeriodId: CLASS }

    expect(await moveStudentToClassFromMcp(scope, input, none)).toBe('notFound')
    expect(await moveStudentToClassFromMcp(scope, input, several)).toBe('ambiguousEnrollment')
    expect(none.reassign).not.toHaveBeenCalled()
    expect(several.reassign).not.toHaveBeenCalled()
  })

  it.each([
    'periodMismatch',
    'classFull',
    'notFound',
    'duplicateEnrollment',
    'invalidStatusTransition',
  ])('passes the use case refusal %s through unchanged', async (refusal) => {
    const result = await moveStudentToClassFromMcp(
      scope,
      { enrollmentId: ENROLLMENT, classPeriodId: CLASS },
      deps(refusal)
    )

    expect(result).toBe(refusal)
  })

  it('rejects an input without enrollment designation or without a class id', async () => {
    const d = deps()

    expect(await moveStudentToClassFromMcp(scope, { classPeriodId: CLASS }, d)).toBe(
      'validationError'
    )
    expect(
      await moveStudentToClassFromMcp(
        scope,
        { studentName: 'Sara', classPeriodId: CLASS } as never,
        d
      )
    ).toBe('validationError')
    expect(await moveStudentToClassFromMcp(scope, { enrollmentId: ENROLLMENT } as never, d)).toBe(
      'validationError'
    )
    expect(d.reassign).not.toHaveBeenCalled()
  })
})
