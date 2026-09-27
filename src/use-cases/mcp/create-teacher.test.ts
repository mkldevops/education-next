import { describe, expect, it, vi } from 'vitest'
import { createTeacherFromMcp } from './create-teacher'

const scope = { schoolId: 'school-1' }

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
      create
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

    const result = await createTeacherFromMcp(scope, { firstName: '', lastName: 'X' }, create)

    expect(result).toBe('validationError')
    expect(create).not.toHaveBeenCalled()
  })

  it('passes a typed refusal through', async () => {
    const create = vi.fn().mockResolvedValue('validationError')

    const result = await createTeacherFromMcp(scope, { firstName: 'A', lastName: 'B' }, create)

    expect(result).toBe('validationError')
  })
})
