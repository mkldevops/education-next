import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore = { get: vi.fn() }
const dbMock = {
  user: { findUnique: vi.fn() },
  userFamily: { findFirst: vi.fn() },
}
const authMock = { api: { getSession: vi.fn() } }
const schoolGatewayMock = { findActiveById: vi.fn(), listActive: vi.fn() }
const schoolMemberGatewayMock = { listAuthorizedSchools: vi.fn() }
const isSchoolSwitchEnabledMock = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => cookieStore,
  headers: async () => new Headers(),
}))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/gateways/school-gateway', () => ({ schoolGateway: schoolGatewayMock }))
vi.mock('@/gateways/school-member-gateway', () => ({
  schoolMemberGateway: schoolMemberGatewayMock,
}))
vi.mock('@/use-cases/platform-settings/is-school-switch-enabled', () => ({
  isSchoolSwitchEnabled: isSchoolSwitchEnabledMock,
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { getAuthorizedSchools, getSchoolContext } = await import('../school-context')

const AL_NOUR = { id: 'school-a', name: 'Al-Nour', slug: 'al-nour' }
const HORIZON = { id: 'school-b', name: 'Horizon', slug: 'horizon' }

const signedInAs = (userId: string, isSuperAdmin: boolean) => {
  authMock.api.getSession.mockResolvedValue({ user: { id: userId } })
  dbMock.user.findUnique.mockResolvedValue({ isSuperAdmin })
}

const membership = (school: typeof AL_NOUR, role: 'ADMIN' | 'PARENT') => ({
  schoolId: school.id,
  role,
  createdAt: new Date('2026-01-01'),
  school,
})

beforeEach(() => {
  vi.clearAllMocks()
  cookieStore.get.mockReturnValue(undefined)
  dbMock.userFamily.findFirst.mockResolvedValue(null)
  schoolGatewayMock.listActive.mockResolvedValue([AL_NOUR, HORIZON])
  schoolMemberGatewayMock.listAuthorizedSchools.mockResolvedValue([])
  isSchoolSwitchEnabledMock.mockResolvedValue(true)
})

describe('getSchoolContext', () => {
  it('gives a super admin a context without any membership', async () => {
    signedInAs('user-1', true)

    const context = await getSchoolContext()

    expect(context).toEqual({
      userId: 'user-1',
      schoolId: AL_NOUR.id,
      isSuperAdmin: true,
      role: null,
    })
    expect(schoolMemberGatewayMock.listAuthorizedSchools).not.toHaveBeenCalled()
  })

  it('falls back to an active school when the cookie names a deactivated one', async () => {
    signedInAs('user-1', true)
    cookieStore.get.mockReturnValue({ value: 'school-gone' })
    schoolGatewayMock.findActiveById.mockResolvedValue(null)

    const context = await getSchoolContext()

    expect(context?.schoolId).toBe(AL_NOUR.id)
  })

  it('denies every school when no school is active', async () => {
    signedInAs('user-1', true)
    schoolGatewayMock.listActive.mockResolvedValue([])

    expect(await getSchoolContext()).toBeNull()
  })

  it('ignores a cookie naming a school the member does not belong to', async () => {
    signedInAs('user-2', false)
    cookieStore.get.mockReturnValue({ value: HORIZON.id })
    schoolMemberGatewayMock.listAuthorizedSchools.mockResolvedValue([membership(AL_NOUR, 'ADMIN')])

    const context = await getSchoolContext()

    expect(context).toEqual({
      userId: 'user-2',
      schoolId: AL_NOUR.id,
      isSuperAdmin: false,
      role: 'ADMIN',
    })
  })

  it('keeps a parent without a linked family out of any family filter', async () => {
    signedInAs('user-3', false)
    schoolMemberGatewayMock.listAuthorizedSchools.mockResolvedValue([membership(AL_NOUR, 'PARENT')])

    const context = await getSchoolContext()

    expect(context).toEqual({
      userId: 'user-3',
      schoolId: AL_NOUR.id,
      isSuperAdmin: false,
      role: 'PARENT',
      familyId: null,
    })
  })

  it('scopes the family lookup to the active school of a multi-school parent', async () => {
    signedInAs('user-3', false)
    cookieStore.get.mockReturnValue({ value: HORIZON.id })
    schoolMemberGatewayMock.listAuthorizedSchools.mockResolvedValue([
      membership(AL_NOUR, 'PARENT'),
      membership(HORIZON, 'PARENT'),
    ])
    dbMock.userFamily.findFirst.mockResolvedValue({ familyId: 'family-horizon' })

    const context = await getSchoolContext()

    expect(dbMock.userFamily.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-3', schoolId: HORIZON.id } })
    )
    expect(context).toMatchObject({ schoolId: HORIZON.id, familyId: 'family-horizon' })
  })

  it('ignores the cookie for an ordinary member when the platform switch is off', async () => {
    signedInAs('user-3', false)
    isSchoolSwitchEnabledMock.mockResolvedValue(false)
    cookieStore.get.mockReturnValue({ value: HORIZON.id })
    schoolMemberGatewayMock.listAuthorizedSchools.mockResolvedValue([
      membership(AL_NOUR, 'PARENT'),
      membership(HORIZON, 'PARENT'),
    ])

    const context = await getSchoolContext()

    expect(context?.schoolId).toBe(AL_NOUR.id)
    expect(dbMock.userFamily.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-3', schoolId: AL_NOUR.id } })
    )
  })

  it('still honours the cookie of a super admin when the platform switch is off', async () => {
    signedInAs('user-1', true)
    isSchoolSwitchEnabledMock.mockResolvedValue(false)
    cookieStore.get.mockReturnValue({ value: HORIZON.id })
    schoolGatewayMock.findActiveById.mockResolvedValue(HORIZON)

    const context = await getSchoolContext()

    expect(context?.schoolId).toBe(HORIZON.id)
    expect(isSchoolSwitchEnabledMock).not.toHaveBeenCalled()
  })

  it('does not read the platform setting when the cookie changes nothing', async () => {
    signedInAs('user-2', false)
    schoolMemberGatewayMock.listAuthorizedSchools.mockResolvedValue([
      membership(AL_NOUR, 'ADMIN'),
      membership(HORIZON, 'ADMIN'),
    ])

    expect(await getSchoolContext()).toMatchObject({ schoolId: AL_NOUR.id })
    expect(isSchoolSwitchEnabledMock).not.toHaveBeenCalled()
  })

  it('rejects a signed-in account that no longer exists', async () => {
    authMock.api.getSession.mockResolvedValue({ user: { id: 'user-4' } })
    dbMock.user.findUnique.mockResolvedValue(null)

    expect(await getSchoolContext()).toBeNull()
  })
})

describe('getAuthorizedSchools', () => {
  it('offers every active school to a super admin', async () => {
    signedInAs('user-1', true)

    expect(await getAuthorizedSchools()).toEqual([
      { ...AL_NOUR, isAdmin: true },
      { ...HORIZON, isAdmin: true },
    ])
  })

  it('carries the capability per school for a multi-school member', async () => {
    signedInAs('user-2', false)
    schoolMemberGatewayMock.listAuthorizedSchools.mockResolvedValue([
      membership(AL_NOUR, 'ADMIN'),
      membership(HORIZON, 'PARENT'),
    ])

    expect(await getAuthorizedSchools()).toEqual([
      { ...AL_NOUR, isAdmin: true },
      { ...HORIZON, isAdmin: false },
    ])
  })

  it('offers nothing to an anonymous caller', async () => {
    authMock.api.getSession.mockResolvedValue(null)

    expect(await getAuthorizedSchools()).toEqual([])
  })
})
