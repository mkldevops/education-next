import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSchoolContextMock = vi.fn()
const translateMock = vi.fn((key: string) => key)

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue(translateMock),
}))
vi.mock('@/lib/school-context', () => ({
  getSchoolContext: getSchoolContextMock,
  isActiveSchoolAdmin: vi.fn(
    (context: { isSuperAdmin: boolean; role: string | null }) =>
      context.isSuperAdmin || context.role === 'ADMIN'
  ),
}))

const { schoolScopedPageMetadata } = await import('./page-metadata')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('schoolScopedPageMetadata', () => {
  it.each([
    {
      userId: 'super-admin-1',
      schoolId: 'school-1',
      isSuperAdmin: true,
      role: null,
    },
    {
      userId: 'admin-1',
      schoolId: 'school-1',
      isSuperAdmin: false,
      role: 'ADMIN',
    },
    {
      userId: 'parent-1',
      schoolId: 'school-1',
      isSuperAdmin: false,
      role: 'PARENT',
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
      role: 'PARENT',
      familyId: null,
    },
    {
      userId: 'teacher-1',
      schoolId: 'school-1',
      isSuperAdmin: false,
      role: 'TEACHER',
    },
  ])('keeps the restricted title for contexts without a family scope', async (context) => {
    getSchoolContextMock.mockResolvedValue(context)

    await expect(schoolScopedPageMetadata('fr', 'dashboard.pages.planning.title')).resolves.toEqual(
      { title: 'errorPages.404.title' }
    )
  })
})
