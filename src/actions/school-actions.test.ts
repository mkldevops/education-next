import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const findUniqueUserMock = vi.fn()
const findActiveByIdMock = vi.fn()
const findMembershipMock = vi.fn()
const isSchoolSwitchEnabledMock = vi.fn()
const cookieSetMock = vi.fn()
const revalidatePathMock = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: cookieSetMock }),
}))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }))
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: findUniqueUserMock } } }))
vi.mock('@/gateways/school-gateway', () => ({
  schoolGateway: { findActiveById: findActiveByIdMock },
}))
vi.mock('@/gateways/school-member-gateway', () => ({
  schoolMemberGateway: { findMembership: findMembershipMock },
}))
vi.mock('@/use-cases/platform-settings/is-school-switch-enabled', () => ({
  isSchoolSwitchEnabled: isSchoolSwitchEnabledMock,
}))

const { switchSchoolAction } = await import('./school-actions')

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111'

const signedIn = (isSuperAdmin: boolean) => {
  getSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
  findUniqueUserMock.mockResolvedValue({ isSuperAdmin })
}

beforeEach(() => {
  vi.clearAllMocks()
  isSchoolSwitchEnabledMock.mockResolvedValue(true)
  findActiveByIdMock.mockResolvedValue({ id: SCHOOL_ID, name: 'Horizon' })
  findMembershipMock.mockResolvedValue({ role: 'ADMIN' })
})

describe('switchSchoolAction, flag enabled', () => {
  it('switches for an ordinary member', async () => {
    signedIn(false)

    expect(await switchSchoolAction(SCHOOL_ID)).toBe('OK')
    expect(cookieSetMock).toHaveBeenCalledWith('active_school', SCHOOL_ID, expect.anything())
    expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout')
  })

  it('refuses a school the member does not belong to', async () => {
    signedIn(false)
    findMembershipMock.mockResolvedValue(null)

    expect(await switchSchoolAction(SCHOOL_ID)).toBe('notFound')
    expect(cookieSetMock).not.toHaveBeenCalled()
  })

  it('refuses a malformed identifier', async () => {
    signedIn(false)

    expect(await switchSchoolAction('not-a-uuid')).toBe('invalidSchoolId')
    expect(cookieSetMock).not.toHaveBeenCalled()
  })

  it('refuses an anonymous caller', async () => {
    getSessionMock.mockResolvedValue(null)

    expect(await switchSchoolAction(SCHOOL_ID)).toBe('unauthenticated')
    expect(cookieSetMock).not.toHaveBeenCalled()
  })
})

describe('switchSchoolAction, flag disabled', () => {
  beforeEach(() => {
    isSchoolSwitchEnabledMock.mockResolvedValue(false)
  })

  it('refuses an ordinary member before writing the cookie', async () => {
    signedIn(false)

    expect(await switchSchoolAction(SCHOOL_ID)).toBe('switchDisabled')
    expect(cookieSetMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('refuses without disclosing whether the school exists', async () => {
    signedIn(false)

    expect(await switchSchoolAction(SCHOOL_ID)).toBe('switchDisabled')
    expect(findActiveByIdMock).not.toHaveBeenCalled()
    expect(findMembershipMock).not.toHaveBeenCalled()
  })

  it('never blocks a super-admin', async () => {
    signedIn(true)

    expect(await switchSchoolAction(SCHOOL_ID)).toBe('OK')
    expect(cookieSetMock).toHaveBeenCalledWith('active_school', SCHOOL_ID, expect.anything())
  })
})
