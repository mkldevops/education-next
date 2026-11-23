import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateMany = vi.fn()
vi.mock('@/lib/db', () => ({ db: { student: { updateMany } } }))

const { reinstateStudent } = await import('./reinstate-student')

const studentId = '0b8f4f8e-5f3c-4d55-9a8e-2f1b6c1d7e01'

describe('reinstateStudent', () => {
  beforeEach(() => updateMany.mockReset())

  it('reactivates an archived student of the school and clears its departure date', async () => {
    updateMany.mockResolvedValue({ count: 1 })

    expect(await reinstateStudent({ schoolId: 'school-a', studentId })).toBe('OK')
    expect(updateMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-a', id: studentId, isActive: false },
      data: { isActive: true, leftAt: null },
    })
  })

  it('answers notFound when no archived student of this school matches', async () => {
    updateMany.mockResolvedValue({ count: 0 })

    expect(await reinstateStudent({ schoolId: 'school-a', studentId })).toBe('notFound')
  })

  it('rejects an invalid student id without writing', async () => {
    expect(await reinstateStudent({ schoolId: 'school-a', studentId: 'nope' })).toBe(
      'validationError'
    )
    expect(updateMany).not.toHaveBeenCalled()
  })
})
