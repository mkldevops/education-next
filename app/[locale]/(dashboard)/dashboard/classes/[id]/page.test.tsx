import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore = { get: vi.fn() }
const dbMock = {
  user: { findUnique: vi.fn() },
  userFamily: { findFirst: vi.fn() },
  classPeriod: { findFirst: vi.fn() },
  level: { findMany: vi.fn() },
  teacher: { findMany: vi.fn() },
  classPeriodTeacher: { findMany: vi.fn() },
}
const authMock = { api: { getSession: vi.fn() } }
const schoolMemberGatewayMock = { listAuthorizedSchools: vi.fn() }
const platformSettingGatewayMock = { get: vi.fn(), set: vi.fn() }
const isPaymentsEnabledMock = vi.fn()

vi.mock('next/server', () => ({ connection: async () => {} }))
vi.mock('next/headers', () => ({
  cookies: async () => cookieStore,
  headers: async () => new Headers(),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('@/i18n/routing', () => ({
  Link: () => null,
  usePathname: () => '/',
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/actions/school-actions', () => ({ switchSchoolAction: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: dbMock }))
vi.mock('@/use-cases/config/is-payments-enabled', () => ({
  isPaymentsEnabled: isPaymentsEnabledMock,
}))
vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/gateways/school-member-gateway', () => ({
  schoolMemberGateway: schoolMemberGatewayMock,
}))
vi.mock('@/gateways/platform-setting-gateway', () => ({
  platformSettingGateway: platformSettingGatewayMock,
}))

// Import dynamique obligatoire : `vi.mock` est hoisté, sa factory est lazy.
const { default: ClassDetailPage } = await import('./page')

const AL_NOUR = { id: 'school-a', name: 'Al-Nour', slug: 'al-nour' }
const HORIZON = { id: 'school-b', name: 'Horizon', slug: 'horizon' }

const membership = (school: typeof AL_NOUR) => ({
  schoolId: school.id,
  roles: ['ADMIN'],
  createdAt: new Date('2026-01-01'),
  school,
})

beforeEach(() => {
  isPaymentsEnabledMock.mockResolvedValue(true)
  vi.clearAllMocks()
  cookieStore.get.mockReturnValue({ value: AL_NOUR.id })
  authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1' } })
  dbMock.user.findUnique.mockResolvedValue({ isSuperAdmin: false })
  dbMock.userFamily.findFirst.mockResolvedValue(null)
  dbMock.level.findMany.mockResolvedValue([{ id: 'level-1', name: 'CP' }])
  schoolMemberGatewayMock.listAuthorizedSchools.mockResolvedValue([
    membership(AL_NOUR),
    membership(HORIZON),
  ])
  // La classe demandée appartient à l'autre école : le cas `otherSchool`.
  dbMock.classPeriod.findFirst.mockResolvedValue({ id: 'class-1', schoolId: HORIZON.id })
})

/**
 * Le rendu réel de la page, pas seulement la valeur passée en propriété. Le reste de la
 * chaîne est vrai : contexte d'école, résolution du lien profond, lecture du réglage,
 * puis le composant client. Seule la frontière est simulée.
 *
 * Les quatre pages de détail partagent exactement cette branche `otherSchool` ; celle
 * des classes est prise comme témoin parce qu'elle n'a ni `searchParams` ni lecture
 * annexe avant la résolution.
 */
describe('ClassDetailPage, ressource dans une autre école', () => {
  it('rend le prompt sans son bouton quand le drapeau plateforme est éteint', async () => {
    platformSettingGatewayMock.get.mockResolvedValue({
      id: 'setting-1',
      name: 'school_switch_enabled',
      value: 'false',
      valueType: 'BOOLEAN',
    })

    render(await ClassDetailPage({ params: Promise.resolve({ locale: 'fr', id: 'class-1' }) }))

    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('switchDisabled')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('rend le bouton de bascule quand le réglage est absent', async () => {
    platformSettingGatewayMock.get.mockResolvedValue(null)

    render(await ClassDetailPage({ params: Promise.resolve({ locale: 'fr', id: 'class-1' }) }))

    expect(screen.getByRole('button', { name: 'switchTo' })).toBeInTheDocument()
    expect(screen.queryByText('switchDisabled')).not.toBeInTheDocument()
  })
})

describe('ClassDetailPage, ressource dans l’école active', () => {
  it('affiche une affectation d’enseignant désactivé et son action de désaffectation', async () => {
    dbMock.classPeriod.findFirst.mockResolvedValue({
      id: 'class-1',
      schoolId: AL_NOUR.id,
      name: 'CP-A',
      capacity: 20,
      levelId: 'level-1',
      periodId: 'period-1',
      level: { name: 'CP' },
      period: { name: '2026-2027' },
      classAssignments: [],
      teachers: [],
    })
    dbMock.teacher.findMany.mockResolvedValue([])
    dbMock.classPeriodTeacher.findMany.mockResolvedValue([
      {
        teacherId: 'teacher-inactive-1',
        teacher: {
          id: 'teacher-inactive-1',
          firstName: 'Sofia',
          lastName: 'Amrani',
          isActive: false,
        },
      },
    ])

    render(await ClassDetailPage({ params: Promise.resolve({ locale: 'fr', id: 'class-1' }) }))

    expect(screen.getByText('Amrani Sofia')).toBeInTheDocument()
    // `aria-label` distingue le bouton quand plusieurs lignes désactivées coexistent :
    // son nom accessible n'est pas le libellé générique visible ('trigger').
    expect(screen.getByRole('button', { name: 'triggerLabel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'trigger' })).not.toBeInTheDocument()
    // La carte ne doit pas prétendre qu'il n'y a aucun enseignant alors qu'une
    // affectation désactivée est listée juste en dessous.
    expect(screen.queryByText('noTeachers')).not.toBeInTheDocument()
  })

  it.each([
    [false, false],
    [true, true],
  ])('shows the plan column only when payments are enabled (%s)', async (enabled, visible) => {
    isPaymentsEnabledMock.mockResolvedValue(enabled)
    dbMock.classPeriod.findFirst.mockResolvedValue({
      id: 'class-1',
      schoolId: AL_NOUR.id,
      name: 'CP-A',
      capacity: 20,
      levelId: 'level-1',
      periodId: 'period-1',
      level: { name: 'CP' },
      period: { name: '2026-2027' },
      classAssignments: [
        {
          id: 'assignment-1',
          startAt: new Date('2026-09-15'),
          enrollment: {
            id: 'enrollment-1',
            status: 'ACTIVE',
            plan: { name: '__unpriced__' },
            student: { id: 'student-1', person: { name: 'Yasmine', lastname: 'Benali' } },
          },
        },
      ],
      teachers: [],
    })
    dbMock.teacher.findMany.mockResolvedValue([])
    dbMock.classPeriodTeacher.findMany.mockResolvedValue([])

    render(await ClassDetailPage({ params: Promise.resolve({ locale: 'fr', id: 'class-1' }) }))

    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.queryByText('__unpriced__')).not.toBeInTheDocument()
    expect(screen.queryByText('plan') !== null).toBe(visible)
    expect(screen.queryByText('unpriced.badge') !== null).toBe(visible)
  })

  it('shows each student age and sex, with a dash when unknown', async () => {
    dbMock.classPeriod.findFirst.mockResolvedValue({
      id: 'class-1',
      schoolId: AL_NOUR.id,
      name: 'CP-A',
      capacity: 20,
      levelId: 'level-1',
      periodId: 'period-1',
      level: { name: 'CP' },
      period: { name: '2026-2027' },
      classAssignments: [
        {
          id: 'assignment-1',
          startAt: new Date('2026-09-15'),
          enrollment: {
            id: 'enrollment-1',
            status: 'ACTIVE',
            plan: { name: 'Forfait' },
            student: {
              id: 'student-1',
              birthday: new Date('2018-03-02'),
              person: { name: 'Yasmine', lastname: 'Benali', sex: 'FEMALE' },
            },
          },
        },
        {
          id: 'assignment-2',
          startAt: new Date('2026-09-15'),
          enrollment: {
            id: 'enrollment-2',
            status: 'ACTIVE',
            plan: { name: 'Forfait' },
            student: {
              id: 'student-2',
              birthday: null,
              person: { name: 'Adam', lastname: 'Kaci', sex: null },
            },
          },
        },
      ],
      teachers: [],
    })
    dbMock.teacher.findMany.mockResolvedValue([])
    dbMock.classPeriodTeacher.findMany.mockResolvedValue([])

    render(await ClassDetailPage({ params: Promise.resolve({ locale: 'fr', id: 'class-1' }) }))

    expect(screen.getByText('ageValue')).toBeInTheDocument()
    expect(screen.getByText('female')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
