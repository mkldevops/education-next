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
  isActiveSchoolAdmin: (context: { roles: string[]; isSuperAdmin: boolean }) =>
    context.isSuperAdmin || context.roles.includes('ADMIN'),
  hasActiveSchoolStaffAccess: async (context: { roles: string[]; staffTeacher?: boolean }) =>
    context.roles.includes('ADMIN') || context.staffTeacher === true,
}))

const { requireSchoolRecordsScope, requireSchoolScope, requireSchoolStaff, requireTeacher } =
  await import('./auth-helper')

const context = (role: 'ADMIN' | 'PARENT' | 'TEACHER', staffTeacher = false) => ({
  userId: 'user-1',
  schoolId: 'school-1',
  isSuperAdmin: false,
  roles: [role],
  staffTeacher,
  familyId: role === 'PARENT' ? 'family-1' : null,
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
        roles: [role],
        familyId: role === 'PARENT' ? 'family-1' : null,
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

describe('requireSchoolScope', () => {
  const member = (roles: string[], familyId: string | null) => ({
    userId: 'user-1',
    schoolId: 'school-1',
    isSuperAdmin: false,
    roles,
    familyId,
  })

  it('gives a teacher who is also a linked parent the parent scope', async () => {
    getSchoolContextMock.mockResolvedValue(member(['TEACHER', 'PARENT'], 'family-1'))
    await expect(requireSchoolScope()).resolves.toEqual({
      schoolId: 'school-1',
      userId: 'user-1',
      isAdmin: false,
      familyId: 'family-1',
    })
  })

  it('lets the admin role win over the parent role', async () => {
    getSchoolContextMock.mockResolvedValue(member(['ADMIN', 'PARENT'], 'family-1'))
    await expect(requireSchoolScope()).resolves.toEqual({
      schoolId: 'school-1',
      userId: 'user-1',
      isAdmin: true,
    })
  })

  it('refuses a teacher without a linked family', async () => {
    getSchoolContextMock.mockResolvedValue(member(['TEACHER'], null))
    await expect(requireSchoolScope()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
