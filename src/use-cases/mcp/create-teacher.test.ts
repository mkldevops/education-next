import { describe, expect, it, vi } from 'vitest'
import { createTeacherFromMcp } from './create-teacher'

const scope = { schoolId: 'school-1' }

const noDuplicate = { findPossibleDuplicates: vi.fn().mockResolvedValue([]) }

describe('createTeacherFromMcp', () => {
  it('creates the teacher in the scoped school, without a class', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 't-1',
      firstName: "Mikaa'il",
      lastName: 'Hamada Sidi',
      email: null,
    })

    const result = await createTeacherFromMcp(
      scope,
      { firstName: " Mikaa'il ", lastName: 'Hamada Sidi' },
      create,
      noDuplicate
    )

    expect(create).toHaveBeenCalledWith({
      firstName: "Mikaa'il",
      lastName: 'Hamada Sidi',
      schoolId: 'school-1',
    })
    expect(result).toEqual({ id: 't-1', firstName: "Mikaa'il", lastName: 'Hamada Sidi' })
  })

  it('refuses an empty name without writing', async () => {
    const create = vi.fn()

    const result = await createTeacherFromMcp(
      scope,
      { firstName: '', lastName: 'X' },
      create,
      noDuplicate
    )

    expect(result).toBe('validationError')
    expect(create).not.toHaveBeenCalled()
  })

  it('passes a typed refusal through', async () => {
    const create = vi.fn().mockResolvedValue('validationError')

    const result = await createTeacherFromMcp(
      scope,
      { firstName: 'A', lastName: 'B' },
      create,
      noDuplicate
    )

    expect(result).toBe('validationError')
  })

  it('suspends the creation and lists an active homonym of the school', async () => {
    const create = vi.fn()
    const match = { id: 't-9', firstName: 'Fatima', lastName: 'Ali' }
    const teacherGw = { findPossibleDuplicates: vi.fn().mockResolvedValue([match]) }

    const result = await createTeacherFromMcp(
      scope,
      { firstName: 'Ali', lastName: 'Fatima', email: 'f.ali@example.test' },
      create,
      teacherGw
    )

    expect(teacherGw.findPossibleDuplicates).toHaveBeenCalledWith('school-1', {
      firstName: 'Ali',
      lastName: 'Fatima',
      email: 'f.ali@example.test',
    })
    expect(result).toEqual({ created: false, reason: 'possibleDuplicate', matches: [match] })
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a homonym when the caller says it is someone else', async () => {
    const create = vi.fn().mockResolvedValue({ id: 't-2', firstName: 'Fatima', lastName: 'Ali' })
    const teacherGw = { findPossibleDuplicates: vi.fn() }

    const result = await createTeacherFromMcp(
      scope,
      { firstName: 'Fatima', lastName: 'Ali', allowDuplicate: true },
      create,
      teacherGw
    )

    expect(teacherGw.findPossibleDuplicates).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith({
      firstName: 'Fatima',
      lastName: 'Ali',
      schoolId: 'school-1',
    })
    expect(result).toEqual({ id: 't-2', firstName: 'Fatima', lastName: 'Ali' })
  })
})
