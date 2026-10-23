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
const { resolveDeepLink } = await import('./deep-link')
const { canSwitchSchool } = await import('./school-switch')

const AL_NOUR = { id: 'school-a', name: 'Al-Nour', slug: 'al-nour' }
const HORIZON = { id: 'school-b', name: 'Horizon', slug: 'horizon' }

const membership = (school: typeof AL_NOUR) => ({
  schoolId: school.id,
  roles: ['ADMIN'],
  createdAt: new Date('2026-01-01'),
  school,
})

beforeEach(() => {
  vi.clearAllMocks()
  cookieStore.get.mockReturnValue(undefined)
  dbMock.userFamily.findFirst.mockResolvedValue(null)
  dbMock.user.findUnique.mockResolvedValue({ isSuperAdmin: false })
  authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1' } })
  schoolMemberGatewayMock.listAuthorizedSchools.mockResolvedValue([
    membership(AL_NOUR),
    membership(HORIZON),
  ])
  isSchoolSwitchEnabledMock.mockResolvedValue(true)
})

/**
 * Le drapeau contraint la bascule, jamais la résolution. Masquer la ressource de l'autre
 * école laisserait l'utilisateur devant un `notFound()` inexplicable sur un lien qu'on
 * vient de lui partager, alors qu'il y a bien accès.
 */
describe('resolveDeepLink sous drapeau plateforme éteint', () => {
  it('classe toujours la ressource de l\'autre école en "otherSchool"', async () => {
    isSchoolSwitchEnabledMock.mockResolvedValue(false)
    cookieStore.get.mockReturnValue({ value: HORIZON.id })

    const find = vi.fn().mockResolvedValue({ id: 'class-1', schoolId: HORIZON.id })
    const resolution = await resolveDeepLink({ requireStaff: true, find })

    // Le cookie est ignoré : l'école active redevient la première appartenance.
    expect(resolution).toEqual({
      status: 'otherSchool',
      school: { ...HORIZON, isAdmin: true, isStaff: true },
    })
    // Les écoles interrogeables restent aveugles au drapeau — `getAuthorizedSchools()`
    // n'est pas altéré, sans quoi la ressource deviendrait introuvable.
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ schoolIds: [AL_NOUR.id, HORIZON.id] })
    )
    expect(await canSwitchSchool()).toBe(false)
  })

  it("ouvre la ressource de l'école active sans rien changer", async () => {
    isSchoolSwitchEnabledMock.mockResolvedValue(false)

    const find = vi.fn().mockResolvedValue({ id: 'class-2', schoolId: AL_NOUR.id })

    expect(await resolveDeepLink({ requireStaff: true, find })).toEqual({
      status: 'found',
      resource: { id: 'class-2', schoolId: AL_NOUR.id },
    })
  })

  it('laisse un super-admin basculer et suivre son cookie', async () => {
    isSchoolSwitchEnabledMock.mockResolvedValue(false)
    dbMock.user.findUnique.mockResolvedValue({ isSuperAdmin: true })
    cookieStore.get.mockReturnValue({ value: HORIZON.id })
    schoolGatewayMock.findActiveById.mockResolvedValue(HORIZON)
    schoolGatewayMock.listActive.mockResolvedValue([AL_NOUR, HORIZON])

    const find = vi.fn().mockResolvedValue({ id: 'class-1', schoolId: HORIZON.id })

    expect(await resolveDeepLink({ requireStaff: true, find })).toMatchObject({ status: 'found' })
    expect(await canSwitchSchool()).toBe(true)
  })
})
