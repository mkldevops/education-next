import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireSchoolAdminMock = vi.fn()
const signUpEmailMock = vi.fn()
const createMembershipMock = vi.fn()

const dbMock = {
  user: { update: vi.fn() },
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: dbMock, dbArchived: dbMock }))
vi.mock('@/lib/db-unscoped', () => ({ countRowsBlockingUserDeletion: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { signUpEmail: signUpEmailMock } } }))
vi.mock('@/gateways/school-member-gateway', () => ({
  schoolMemberGateway: { createMembership: createMembershipMock },
}))
vi.mock('./auth-helper', () => ({
  requireSchoolAdmin: requireSchoolAdminMock,
  requirePlatformAdmin: vi.fn(),
}))

const { createUserAction } = await import('./user-actions')

const INPUT = { name: 'Karim Benali', password: 'password123', role: 'PARENT' as const }

beforeEach(() => {
  vi.clearAllMocks()
  requireSchoolAdminMock.mockResolvedValue({ schoolId: 'school-b', userId: 'admin-1' })
  signUpEmailMock.mockResolvedValue({ user: { id: 'user-2' } })
  dbMock.user.update.mockResolvedValue({ id: 'user-2' })
  createMembershipMock.mockResolvedValue({ userId: 'user-2', schoolId: 'school-b' })
})

describe('createUserAction', () => {
  it('creates the account with the address in lower case', async () => {
    const result = await createUserAction({ ...INPUT, email: 'Karim.Benali@School.TEST' })

    expect(signUpEmailMock).toHaveBeenCalledWith({
      body: { name: INPUT.name, email: 'karim.benali@school.test', password: INPUT.password },
    })
    expect(result).toEqual({ id: 'user-2', email: 'karim.benali@school.test' })
  })

  it('rejects an invalid address before creating anything', async () => {
    expect(await createUserAction({ ...INPUT, email: 'nope' })).toBe('validation_error')
    expect(signUpEmailMock).not.toHaveBeenCalled()
  })
})
