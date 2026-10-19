import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSchoolContextMock = vi.fn()
const findFirstMock = vi.fn()

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect: vi.fn(),
}))
vi.mock('next-intl/server', () => ({ getLocale: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { teacher: { findFirst: findFirstMock } } }))
vi.mock('@/lib/school-context', () => ({
  getSchoolContext: getSchoolContextMock,
  isActiveSchoolAdmin: (context: { role: string; isSuperAdmin: boolean }) =>
    context.isSuperAdmin || context.role === 'ADMIN',
  hasActiveSchoolStaffAccess: async (context: { role: string; staffTeacher?: boolean }) =>
    context.role === 'ADMIN' || context.staffTeacher === true,
}))

const { requireSchoolRecordsScope, requireSchoolStaff, requireTeacher } = await import(
  './auth-helper'
)

const context = (role: 'ADMIN' | 'PARENT' | 'TEACHER', staffTeacher = false) => ({
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false,
  role,
  staffTeacher,
  ...(role === 'PARENT' ? { familyId: 'family-1' } : {}),
})

beforeEach(() => {
  vi.clearAllMocks()
  findFirstMock.mockResolvedValue({ id: 'teacher-1' })
})

describe('requireTeacher', () => {
  it.each(['ADMIN', 'PARENT'] as const)(
    'permits a %s membership that is also linked to an active teacher profile',
    async (role) => {
      getSchoolContextMock.mockResolvedValue({
        userId: 'user-1',
        schoolId: 'school-1',
        isSuperAdmin: false,
        role,
        ...(role === 'PARENT' ? { familyId: 'family-1' } : {}),
      })

      await expect(requireTeacher()).resolves.toEqual({
        userId: 'user-1',
        schoolId: 'school-1',
        teacherId: 'teacher-1',
      })
      expect(findFirstMock).toHaveBeenCalledWith({
        where: { schoolId: 'school-1', userId: 'user-1', isActive: true },
        select: { id: true },
      })
    }
  )
})

describe('requireSchoolStaff', () => {
  it('admits an admin as admin and a staff teacher as non-admin', async () => {
    getSchoolContextMock.mockResolvedValue(context('ADMIN'))
    await expect(requireSchoolStaff()).resolves.toEqual({
      schoolId: 'school-1',
      userId: 'user-1',
      isAdmin: true,
    })

    getSchoolContextMock.mockResolvedValue(context('TEACHER', true))
    await expect(requireSchoolStaff()).resolves.toEqual({
      schoolId: 'school-1',
      userId: 'user-1',
      isAdmin: false,
    })
  })

  it.each([
    ['a teacher without extended access', context('TEACHER')],
    ['a parent', context('PARENT')],
  ])('refuses %s', async (_label, value) => {
    getSchoolContextMock.mockResolvedValue(value)
    await expect(requireSchoolStaff()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})

describe('requireSchoolRecordsScope', () => {
  it('opens the whole school to a staff teacher', async () => {
    getSchoolContextMock.mockResolvedValue(context('TEACHER', true))
    await expect(requireSchoolRecordsScope()).resolves.toEqual({
      schoolId: 'school-1',
      userId: 'user-1',
      isStaff: true,
      isAdmin: false,
    })
  })
})
