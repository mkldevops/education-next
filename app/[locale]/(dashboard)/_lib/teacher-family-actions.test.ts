import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireTeacherMock = vi.fn()
const createFamilyMock = vi.fn()
const createStudentMock = vi.fn()
const dbMock = { family: { findFirst: vi.fn() } }

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('./auth-helper', () => ({ requireTeacher: requireTeacherMock }))
vi.mock('@/use-cases/families/create-family', () => ({ createFamily: createFamilyMock }))
vi.mock('@/use-cases/students/create-student', () => ({ createStudent: createStudentMock }))

const { createFamilyAsTeacherAction, createStudentAsTeacherAction } = await import(
  './teacher-family-actions'
)

const FAMILY_ID = '22222222-2222-4222-8222-222222222222'
const STUDENT = {
  familyId: FAMILY_ID,
  person: { name: 'Lina', lastname: 'Martin' },
  student: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  requireTeacherMock.mockResolvedValue({
    schoolId: 'school-1',
    userId: 'user-1',
    teacherId: 'teacher-1',
  })
  createFamilyMock.mockResolvedValue({ id: FAMILY_ID })
  createStudentMock.mockResolvedValue({ id: 'student-1' })
  dbMock.family.findFirst.mockResolvedValue({ id: FAMILY_ID })
})

describe('createFamilyAsTeacherAction', () => {
  it('records the family in the teacher school as created by the teacher', async () => {
    const result = await createFamilyAsTeacherAction({
      name: 'Martin',
      parents: [{ name: 'Sarah', lastname: 'Martin' }],
    })

    expect(result).toEqual({ id: FAMILY_ID })
    expect(createFamilyMock).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-1', createdById: 'user-1', name: 'Martin' })
    )
  })
})

describe('createStudentAsTeacherAction', () => {
  it('adds a student only to a family the teacher registered', async () => {
    expect(await createStudentAsTeacherAction(STUDENT)).toEqual({ studentId: 'student-1' })
    expect(dbMock.family.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FAMILY_ID, schoolId: 'school-1', createdById: 'user-1', isActive: true },
      })
    )
    expect(createStudentMock).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-1', familyId: FAMILY_ID })
    )
  })

  it('refuses a family registered by someone else', async () => {
    dbMock.family.findFirst.mockResolvedValue(null)

    expect(await createStudentAsTeacherAction(STUDENT)).toBe('notFound')
    expect(createStudentMock).not.toHaveBeenCalled()
  })

  it('rejects invalid input before any lookup', async () => {
    expect(await createStudentAsTeacherAction({ ...STUDENT, familyId: 'nope' })).toBe(
      'validationError'
    )
    expect(dbMock.family.findFirst).not.toHaveBeenCalled()
  })
})
