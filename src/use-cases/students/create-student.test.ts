import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = {
  $queryRaw: vi.fn(),
  person: { create: vi.fn() },
  student: { create: vi.fn() },
}
vi.mock('@/lib/db', () => ({
  db: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) },
}))
const { createStudent } = await import('./create-student')

const input = {
  schoolId: 'school-1',
  familyId: '123e4567-e89b-12d3-a456-426614174000',
  person: { name: 'John', lastname: 'Doe' },
  student: { birthday: null, snackAuthorization: false },
}

describe('createStudent', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    tx.$queryRaw.mockResolvedValue([{ id: input.familyId }])
    tx.person.create.mockResolvedValue({ id: 'person-1' })
    tx.student.create.mockResolvedValue({ id: 'student-1' })
  })

  it('rejects an unavailable family without creating a person or student', async () => {
    tx.$queryRaw.mockResolvedValue([])
    expect(await createStudent(input)).toBe('notFound')
    expect(tx.person.create).not.toHaveBeenCalled()
    expect(tx.student.create).not.toHaveBeenCalled()
  })

  it('creates the person, family link and student in the same transaction', async () => {
    expect(await createStudent(input)).toEqual({ id: 'student-1' })
    expect(tx.person.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        families: { create: { familyId: input.familyId, relationType: 'OTHER' } },
      }),
    })
    expect(tx.student.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        personId: 'person-1',
        birthday: null,
      }),
    })
  })

  it('rejects invalid input before writing', async () => {
    expect(await createStudent({ ...input, familyId: 'invalid' })).toBe('validationError')
    expect(tx.person.create).not.toHaveBeenCalled()
  })
})
