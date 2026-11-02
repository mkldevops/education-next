import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSchoolContextMock = vi.fn()
const findFirstMock = vi.fn()
const isMealsEnabledMock = vi.fn()

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
  hasSchoolRole: (context: { roles: string[]; isSuperAdmin: boolean }, role: string) =>
    !context.isSuperAdmin && context.roles.includes(role),
  hasActiveSchoolStaffAccess: async (context: { roles: string[]; staffTeacher?: boolean }) =>
    context.roles.includes('ADMIN') || context.staffTeacher === true,
}))
vi.mock('@/use-cases/config/is-meals-enabled', () => ({ isMealsEnabled: isMealsEnabledMock }))

const {
  requireSchoolAdmin,
  canOpenSchoolCashier,
  requireSchoolCashier,
  requireSchoolRecordsScope,
  requireSchoolScope,
  requireSchoolStaff,
  requireTeacher,
} = await import('./auth-helper')

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
  isMealsEnabledMock.mockResolvedValue(true)
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

describe('cashier role', () => {
  const member = (roles: string[], familyId: string | null = null) => ({
    userId: 'user-1',
    schoolId: 'school-1',
    isSuperAdmin: false,
    roles,
    familyId,
  })

  it.each([
    ['a cashier', member(['CASHIER'])],
    ['a cashier-parent', member(['CASHIER', 'PARENT'], 'family-1')],
    ['a cashier-teacher', member(['CASHIER', 'TEACHER'])],
  ])('opens the cashier to %s, without the admin-only operations', async (_label, value) => {
    getSchoolContextMock.mockResolvedValue(value)
    await expect(requireSchoolCashier()).resolves.toEqual({
      schoolId: 'school-1',
      userId: 'user-1',
      isAdmin: false,
    })
  })

  it('keeps the cashier open to an admin, as admin', async () => {
    getSchoolContextMock.mockResolvedValue(member(['ADMIN']))
    await expect(requireSchoolCashier()).resolves.toMatchObject({ isAdmin: true })
  })

  it.each([
    ['a parent', member(['PARENT'], 'family-1')],
    ['a teacher', member(['TEACHER'])],
  ])('refuses the cashier to %s', async (_label, value) => {
    getSchoolContextMock.mockResolvedValue(value)
    await expect(requireSchoolCashier()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it.each([
    ['a cashier', member(['CASHIER'])],
    ['an admin', member(['ADMIN'])],
  ])('answers 404 to %s of a school without meals', async (_label, value) => {
    getSchoolContextMock.mockResolvedValue(value)
    isMealsEnabledMock.mockResolvedValue(false)
    await expect(requireSchoolCashier()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it.each([
    ['a cashier', member(['CASHIER']), true],
    ['an admin', member(['ADMIN']), true],
    ['a teacher', member(['TEACHER']), false],
    ['a parent', member(['PARENT'], 'family-1'), false],
  ])('tells whether %s may follow a link to the cashier', async (_label, value, expected) => {
    await expect(canOpenSchoolCashier(value as never)).resolves.toBe(expected)
  })

  it('offers no cashier link when the school has no meals', async () => {
    isMealsEnabledMock.mockResolvedValue(false)
    await expect(canOpenSchoolCashier(member(['ADMIN']) as never)).resolves.toBe(false)
  })

  // Critère 14 : élèves, familles, classes, annulations et ajustements restent derrière ces
  // gardes, que le rôle caisse n'ouvre pas, seul ou cumulé.
  it.each([
    ['a cashier', member(['CASHIER'])],
    ['a cashier-parent', member(['CASHIER', 'PARENT'], 'family-1')],
    ['a cashier-teacher', member(['CASHIER', 'TEACHER'])],
  ])('refuses the administration and the staff scope to %s', async (_label, value) => {
    getSchoolContextMock.mockResolvedValue(value)
    await expect(requireSchoolAdmin()).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(requireSchoolStaff()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('gives a cashier-parent no more than the parent scope on school records', async () => {
    getSchoolContextMock.mockResolvedValue(member(['CASHIER', 'PARENT'], 'family-1'))
    await expect(requireSchoolScope()).resolves.toEqual({
      schoolId: 'school-1',
      userId: 'user-1',
      isAdmin: false,
      familyId: 'family-1',
    })
  })

  it('refuses the school records to a cashier without a family', async () => {
    getSchoolContextMock.mockResolvedValue(member(['CASHIER']))
    await expect(requireSchoolScope()).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(requireSchoolRecordsScope()).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
