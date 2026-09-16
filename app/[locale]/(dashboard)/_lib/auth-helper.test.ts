import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSchoolContextMock = vi.fn()
const findFirstMock = vi.fn()

vi.mock('next/navigation', () => ({ notFound: vi.fn(), redirect: vi.fn() }))
vi.mock('next-intl/server', () => ({ getLocale: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { teacher: { findFirst: findFirstMock } } }))
vi.mock('@/lib/school-context', () => ({ getSchoolContext: getSchoolContextMock }))

const { requireTeacher } = await import('./auth-helper')

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
