import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSchoolContextMock = vi.fn()
const translateMock = vi.fn((key: string) => key)

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue(translateMock),
}))
vi.mock('@/lib/school-context', () => ({
  getSchoolContext: getSchoolContextMock,
  hasSchoolRole: (context: { isSuperAdmin: boolean; roles: string[] }, role: string) =>
    !context.isSuperAdmin && context.roles.includes(role),
  isActiveSchoolAdmin: (context: { isSuperAdmin: boolean; roles: string[] }) =>
    context.isSuperAdmin || context.roles.includes('ADMIN'),
}))

const { cashierPageMetadata, schoolScopedPageMetadata } = await import('./page-metadata')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('schoolScopedPageMetadata', () => {
  it.each([
    {
      userId: 'super-admin-1',
      schoolId: 'school-1',
      isSuperAdmin: true,
      roles: [],
    },
    {
      userId: 'admin-1',
      schoolId: 'school-1',
      isSuperAdmin: false,
      roles: ['ADMIN'],
    },
    {
      userId: 'parent-1',
      schoolId: 'school-1',
      isSuperAdmin: false,
      roles: ['PARENT'],
      familyId: 'family-1',
    },
  ])('exposes the page title to a context with a school scope', async (context) => {
    getSchoolContextMock.mockResolvedValue(context)

    await expect(schoolScopedPageMetadata('fr', 'dashboard.pages.planning.title')).resolves.toEqual(
      { title: 'dashboard.pages.planning.title' }
    )
  })

  it.each([
    null,
    {
      userId: 'parent-1',
      schoolId: 'school-1',
      isSuperAdmin: false,
      roles: ['PARENT'],
      familyId: null,
    },
    {
      userId: 'teacher-1',
      schoolId: 'school-1',
      isSuperAdmin: false,
      roles: ['TEACHER'],
      familyId: null,
    },
  ])('keeps the restricted title for contexts without a family scope', async (context) => {
    getSchoolContextMock.mockResolvedValue(context)

    await expect(schoolScopedPageMetadata('fr', 'dashboard.pages.planning.title')).resolves.toEqual(
      { title: 'errorPages.404.title' }
    )
  })
})

describe('cashierPageMetadata', () => {
  const member = (roles: string[], isSuperAdmin = false) => ({
    userId: 'user-1',
    schoolId: 'school-1',
    isSuperAdmin,
    roles,
    familyId: null,
  })

  it.each([
    member(['CASHIER']),
    member(['TEACHER', 'CASHIER']),
    member(['ADMIN']),
    member([], true),
  ])('exposes the page title to the cashier or the administration', async (context) => {
    getSchoolContextMock.mockResolvedValue(context)

    await expect(cashierPageMetadata('fr', 'dashboard.pages.cashier.title')).resolves.toEqual({
      title: 'dashboard.pages.cashier.title',
    })
  })

  it.each([null, member(['TEACHER']), member(['PARENT'])])(
    'keeps the restricted title for anyone else',
    async (context) => {
      getSchoolContextMock.mockResolvedValue(context)

      await expect(cashierPageMetadata('fr', 'dashboard.pages.cashier.title')).resolves.toEqual({
        title: 'errorPages.404.title',
      })
    }
  )
})
