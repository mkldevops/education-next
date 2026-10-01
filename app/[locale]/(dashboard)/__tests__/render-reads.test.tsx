// @vitest-environment node

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@/generated/prisma/client'

/**
 * Couverture du garde tenant sur les **lectures de rendu**.
 *
 * La suite et le build ne prouvent rien ici : toutes les routes du dashboard sont
 * dynamiques, donc `next build` ne les rend jamais, et les tests de use-cases
 * remplacent `@/lib/db` par un mock qui ne traverse pas l'extension.
 *
 * Ce fichier appelle les fonctions de chargement elles-mêmes — le `default` et le
 * `generateMetadata` de chaque page, plus les lectures des composants de layout non
 * exportés — contre la vraie base, en mode `throw`. Seule la frontière HTTP est
 * simulée (`cookies`, `headers`, session, traductions) : `getSchoolContext()` et
 * toutes les requêtes Prisma sont réelles.
 *
 * Limite déclarée : appeler un Server Component asynchrone construit son arbre JSX
 * sans exécuter ses enfants. Aucun `_components/**` n'importe `@/lib/db`, et les
 * deux composants non exportés des layouts (`DashboardSidebarServer`, `ThemeProvider`)
 * ont leurs lectures appelées directement plus bas.
 */

const databaseUrl = process.env.DATABASE_URL

const cookieStore = new Map<string, string>()
let sessionUser: { id: string; name: string; email: string } | null = null

class RedirectSentinel extends Error {
  constructor(readonly target: string) {
    super(`redirect:${target}`)
  }
}

class NotFoundSentinel extends Error {
  constructor() {
    super('notFound')
  }
}

vi.mock('next/server', () => ({ connection: async () => {} }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name)
      return value === undefined ? undefined : { name, value }
    },
  }),
  headers: async () => new Headers(),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFoundSentinel()
  },
  redirect: (target: string) => {
    throw new RedirectSentinel(target)
  },
}))

// `next-intl/navigation` charge `next/navigation` par une spécification que Node ne
// résout pas hors du bundler Next. Rien de tout cela n'est une lecture de données :
// la navigation localisée est remplacée par le même sentinelle que `next/navigation`.
vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['fr', 'en'], defaultLocale: 'fr' },
  Link: () => null,
  redirect: ({ href }: { href: string }) => {
    throw new RedirectSentinel(href)
  },
  usePathname: () => '/',
  useRouter: () => ({}),
  getPathname: ({ href }: { href: string }) => href,
}))

function translator() {
  const t = (key: string) => key
  return Object.assign(t, {
    rich: (key: string) => key,
    markup: (key: string) => key,
    raw: (key: string) => key,
    has: () => true,
  })
}

vi.mock('next-intl/server', () => ({
  getTranslations: async () => translator(),
  setRequestLocale: () => {},
  getLocale: async () => 'fr',
  getMessages: async () => ({}),
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => (sessionUser ? { user: sessionUser } : null) } },
}))

const { createUnguardedArchivedClient } = await import('@/lib/db')
const { ACTIVE_SCHOOL_COOKIE, getAuthorizedSchools, getSchoolContext } = await import(
  '@/lib/school-context'
)
const { getBrandingConfig, resolveBrandingSchoolId } = await import('@/lib/branding')
const { DashboardHeader } = await import('@/features/dashboard/header')
const { getSelectedPeriod } = await import('@/features/dashboard/period')
const { canSwitchSchool } = await import('../_lib/school-switch')

type Fixture = Awaited<ReturnType<typeof seedSchool>>

let raw: PrismaClient
let a: Fixture
let b: Fixture

async function seedSchool(label: string, suffix: string) {
  const school = await raw.school.create({
    data: { name: `render ${label}`, slug: `render-${label}-${suffix}` },
  })

  const [admin, parent, superAdmin] = await Promise.all([
    raw.user.create({
      data: { email: `admin-${label}-${suffix}@render.test`, name: `admin ${label}` },
    }),
    raw.user.create({
      data: { email: `parent-${label}-${suffix}@render.test`, name: `parent ${label}` },
    }),
    raw.user.create({
      data: {
        email: `root-${label}-${suffix}@render.test`,
        name: `root ${label}`,
        isSuperAdmin: true,
      },
    }),
  ])

  await raw.schoolMember.createMany({
    data: [
      { userId: admin.id, schoolId: school.id, role: 'ADMIN' },
      { userId: parent.id, schoolId: school.id, role: 'PARENT' },
    ],
  })

  const family = await raw.family.create({
    data: { schoolId: school.id, name: `fam ${label}`, createdById: admin.id },
  })
  await raw.userFamily.create({
    data: { userId: parent.id, familyId: family.id, schoolId: school.id },
  })
  const person = await raw.person.create({
    data: { schoolId: school.id, name: 'Kid', lastname: label, sex: 'MALE' },
  })
  await raw.familyPerson.create({
    data: {
      familyId: family.id,
      personId: person.id,
      schoolId: school.id,
      relationType: 'PARENT',
    },
  })
  const student = await raw.student.create({
    data: { schoolId: school.id, personId: person.id, birthday: new Date('2015-01-01') },
  })
  await raw.phoneNumber.create({
    data: { schoolId: school.id, personId: person.id, phoneNumber: '0600000000' },
  })

  // Garde alternée : le même élève est rattaché à un second foyer, lu par un autre
  // parent. Les deux rattachements sont `PARENT` pour que seul l'ordre de Postgres
  // les départage — c'est précisément ce qui ne doit pas décider de la famille affichée.
  const otherParent = await raw.user.create({
    data: { email: `other-parent-${label}-${suffix}@render.test`, name: `other parent ${label}` },
  })
  await raw.schoolMember.create({
    data: { userId: otherParent.id, schoolId: school.id, role: 'PARENT' },
  })
  const otherFamily = await raw.family.create({
    data: { schoolId: school.id, name: `other fam ${label}`, createdById: admin.id },
  })
  await raw.userFamily.create({
    data: { userId: otherParent.id, familyId: otherFamily.id, schoolId: school.id },
  })
  await raw.familyPerson.create({
    data: {
      familyId: otherFamily.id,
      personId: person.id,
      schoolId: school.id,
      relationType: 'PARENT',
    },
  })

  const plan = await raw.plan.create({
    data: { schoolId: school.id, name: `plan ${label}`, amount: 100 },
  })
  const level = await raw.level.create({ data: { schoolId: school.id, name: `level ${label}` } })
  const period = await raw.period.create({
    data: {
      schoolId: school.id,
      name: `period ${label}`,
      startAt: new Date('2026-09-01'),
      endAt: new Date('2027-06-30'),
    },
  })
  const classPeriod = await raw.classPeriod.create({
    data: {
      schoolId: school.id,
      name: `class ${label}`,
      capacity: 10,
      levelId: level.id,
      periodId: period.id,
    },
  })
  const teacher = await raw.teacher.create({
    data: {
      schoolId: school.id,
      firstName: `teacher ${label}`,
      lastName: 'Render',
      email: `teacher-${label}-${suffix}@render.test`,
    },
  })
  await raw.classPeriodTeacher.create({
    data: { schoolId: school.id, classPeriodId: classPeriod.id, teacherId: teacher.id },
  })

  const enrollment = await raw.enrollment.create({
    data: {
      schoolId: school.id,
      studentId: student.id,
      planId: plan.id,
      status: 'ACTIVE',
      totalAmount: 100,
    },
  })
  await raw.classAssignment.create({
    data: { schoolId: school.id, enrollmentId: enrollment.id, classPeriodId: classPeriod.id },
  })
  const paymentTransaction = await raw.paymentTransaction.create({
    data: {
      schoolId: school.id,
      familyId: family.id,
      initiatedById: parent.id,
      amount: 100,
      provider: 'STRIPE',
    },
  })
  await raw.payment.create({
    data: {
      schoolId: school.id,
      familyId: family.id,
      enrollmentId: enrollment.id,
      paymentTransactionId: paymentTransaction.id,
      amount: 50,
      method: 'CARD',
      paidAt: new Date(),
    },
  })
  await raw.config.createMany({
    data: [
      { schoolId: school.id, name: 'theme_primary', value: '#123456', valueType: 'COLOR' },
      { schoolId: school.id, name: 'max_students_per_class', value: '20', valueType: 'NUMBER' },
      {
        schoolId: school.id,
        name: 'teacher_expenses_enabled',
        value: 'true',
        valueType: 'BOOLEAN',
      },
      { schoolId: school.id, name: 'events_enabled', value: 'true', valueType: 'BOOLEAN' },
    ],
  })
  await raw.teacherExpense.create({
    data: {
      schoolId: school.id,
      teacherId: teacher.id,
      amount: 25,
      category: 'Goûter',
      description: `goûter ${label}`,
      requestedAt: new Date('2026-09-15'),
    },
  })
  await raw.invitation.create({
    data: {
      schoolId: school.id,
      email: `invited-${label}-${suffix}@render.test`,
      role: 'PARENT',
      token: `token-${label}-${suffix}`,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdById: admin.id,
    },
  })

  return {
    school,
    admin,
    parent,
    superAdmin,
    family,
    otherParent,
    otherFamily,
    person,
    student,
    plan,
    level,
    period,
    classPeriod,
    teacher,
    enrollment,
  }
}

async function cleanup(fixture: Fixture) {
  const schoolId = fixture.school.id
  await raw.invitation.deleteMany({ where: { schoolId } })
  await raw.config.deleteMany({ where: { schoolId } })
  await raw.payment.deleteMany({ where: { schoolId } })
  await raw.paymentTransaction.deleteMany({ where: { schoolId } })
  await raw.teacherExpense.deleteMany({ where: { schoolId } })
  await raw.classPeriodTeacher.deleteMany({ where: { schoolId } })
  await raw.classAssignment.deleteMany({ where: { schoolId } })
  await raw.enrollment.deleteMany({ where: { schoolId } })
  await raw.classPeriod.deleteMany({ where: { schoolId } })
  await raw.teacher.deleteMany({ where: { schoolId } })
  await raw.period.deleteMany({ where: { schoolId } })
  await raw.level.deleteMany({ where: { schoolId } })
  await raw.plan.deleteMany({ where: { schoolId } })
  await raw.phoneNumber.deleteMany({ where: { schoolId } })
  await raw.student.deleteMany({ where: { schoolId } })
  await raw.familyPerson.deleteMany({ where: { schoolId } })
  await raw.person.deleteMany({ where: { schoolId } })
  await raw.userFamily.deleteMany({ where: { schoolId } })
  await raw.family.deleteMany({ where: { schoolId } })
  await raw.schoolMember.deleteMany({ where: { schoolId } })
  await raw.school.delete({ where: { id: schoolId } })
  await raw.user.deleteMany({
    where: {
      id: {
        in: [fixture.admin.id, fixture.parent.id, fixture.otherParent.id, fixture.superAdmin.id],
      },
    },
  })
}

function signIn(user: { id: string; name: string | null; email: string }, schoolId: string) {
  sessionUser = { id: user.id, name: user.name ?? '', email: user.email }
  cookieStore.set(ACTIVE_SCHOOL_COOKIE, schoolId)
}

it('is never silently skipped in continuous integration', () => {
  expect(Boolean(process.env.CI) && !databaseUrl).toBe(false)
})

describe.skipIf(!databaseUrl)('render reads under the `throw` guard', () => {
  let previousMode: string | undefined

  beforeAll(async () => {
    raw = createUnguardedArchivedClient()
    const suffix = Date.now().toString(36)
    a = await seedSchool('a', suffix)
    b = await seedSchool('b', suffix)
  }, 90_000)

  afterAll(async () => {
    if (!raw) return
    if (b) await cleanup(b)
    if (a) await cleanup(a)
    await raw.$disconnect()
  }, 90_000)

  // Le mode est épinglé plutôt que laissé au défaut : ce fichier doit être
  // déterministe quel que soit l'environnement qui le lance. Le défaut lui-même est
  // verrouillé ailleurs, par `src/lib/__tests__/tenant-guard.test.ts`.
  //
  // Sous `throw`, `reportTenantViolation` lève avant d'atteindre son `console.warn` :
  // le signal d'échec est le `TenantScopeError` remonté par l'appel, il n'y a pas de
  // journal à inspecter ici.
  beforeEach(() => {
    previousMode = process.env.TENANT_GUARD_MODE
    process.env.TENANT_GUARD_MODE = 'throw'
    cookieStore.clear()
    sessionUser = null
  })

  afterEach(() => {
    if (previousMode === undefined) {
      delete process.env.TENANT_GUARD_MODE
    } else {
      process.env.TENANT_GUARD_MODE = previousMode
    }
  })

  const params = () => Promise.resolve({ locale: 'fr' })

  describe('context, layouts and header', () => {
    it('resolves the context, branding and authorized schools for an admin', async () => {
      signIn(a.admin, a.school.id)

      const context = await getSchoolContext()
      expect(context?.schoolId).toBe(a.school.id)

      await resolveBrandingSchoolId()
      await getBrandingConfig(a.school.id)
      await getAuthorizedSchools()
      expect(await canSwitchSchool()).toBe(true)
      await getSelectedPeriod(a.school.id)
      await DashboardHeader()
    })

    it('resolves the context and branding for a parent', async () => {
      signIn(a.parent, a.school.id)

      const context = await getSchoolContext()
      expect(context?.role).toBe('PARENT')

      await resolveBrandingSchoolId()
      await getBrandingConfig(a.school.id)
      await getAuthorizedSchools()
      expect(await canSwitchSchool()).toBe(true)
      await DashboardHeader()
    })

    it('resolves the context and branding for a super-admin', async () => {
      signIn(a.superAdmin, b.school.id)

      const context = await getSchoolContext()
      expect(context?.isSuperAdmin).toBe(true)
      expect(context?.schoolId).toBe(b.school.id)

      await resolveBrandingSchoolId()
      await getAuthorizedSchools()
      expect(await canSwitchSchool()).toBe(true)
      await DashboardHeader()
    })

    it('reads the root theme without a session, from the cookie alone', async () => {
      cookieStore.set(ACTIVE_SCHOOL_COOKIE, a.school.id)

      expect(await resolveBrandingSchoolId()).toBe(a.school.id)
      await getBrandingConfig(a.school.id)
    })

    // Le layout racine porte la seule requête Prisma écrite en ligne dans un layout ;
    // elle est appelée ici, et non approchée par `getBrandingConfig`.
    it('runs the root layout theme query', async () => {
      cookieStore.set(ACTIVE_SCHOOL_COOKIE, a.school.id)
      const { default: RootLayout, generateMetadata } = await import('../../layout')

      await generateMetadata({ children: null, params: params() })
      await RootLayout({ children: null, params: params() })
    })
  })

  describe('list pages, as an admin', () => {
    beforeEach(() => {
      signIn(a.admin, a.school.id)
    })

    it('dashboard', async () => {
      const { default: Page, generateMetadata } = await import('../dashboard/page')
      await generateMetadata({ params: params() })
      await Page({ params: params() })
    })

    it('families', async () => {
      const { default: Page } = await import('../dashboard/families/page')
      await Page({ params: params(), searchParams: Promise.resolve({}) })
    })

    it('students', async () => {
      const { default: Page } = await import('../dashboard/students/page')
      await Page({ params: params() })
    })

    it('enrollments', async () => {
      const { default: Page } = await import('../dashboard/enrollments/page')
      await Page({ params: params(), searchParams: Promise.resolve({}) })
    })

    it('payments', async () => {
      const { default: Page } = await import('../dashboard/payments/page')
      await Page({ params: params() })
    })

    it('classes', async () => {
      const { default: Page } = await import('../dashboard/classes/page')
      await Page({ params: params() })
    })

    it('teachers', async () => {
      const { default: Page, generateMetadata } = await import('../dashboard/teachers/page')
      await generateMetadata({ params: params(), searchParams: Promise.resolve({}) })
      await Page({ params: params(), searchParams: Promise.resolve({}) })
    })

    it('events', async () => {
      const { default: Page, generateMetadata } = await import('../dashboard/events/page')
      await generateMetadata({ params: params(), searchParams: Promise.resolve({}) })
      await Page({ params: params(), searchParams: Promise.resolve({}) })
    })

    it('levels', async () => {
      const { default: Page } = await import('../dashboard/levels/page')
      await Page({ params: params() })
    })

    it('periods', async () => {
      const { default: Page } = await import('../dashboard/periods/page')
      await Page({ params: params() })
    })

    it('plans', async () => {
      const { default: Page } = await import('../dashboard/plans/page')
      await Page({ params: params() })
    })

    it('configuration', async () => {
      const { default: Page } = await import('../dashboard/config/page')
      await Page({ params: params() })
    })

    it('users', async () => {
      const { default: Page } = await import('../dashboard/users/page')
      await Page({ params: params() })
    })

    it('sessions and accounts', async () => {
      const { default: Page } = await import('../dashboard/settings/page')
      await Page({ params: params() })
    })
  })

  describe('detail pages, as an admin', () => {
    beforeEach(() => {
      signIn(a.admin, a.school.id)
    })

    it('family detail', async () => {
      const { default: Page, generateMetadata } = await import('../dashboard/families/[id]/page')
      const props = () => ({
        params: Promise.resolve({ locale: 'fr', id: a.family.id }),
        searchParams: Promise.resolve({}),
      })
      await generateMetadata(props())
      await Page(props())
    })

    it('student detail', async () => {
      const { default: Page, generateMetadata } = await import('../dashboard/students/[id]/page')
      const props = () => ({ params: Promise.resolve({ locale: 'fr', id: a.student.id }) })
      await generateMetadata(props())
      await Page(props())
    })

    it('enrollment detail', async () => {
      const { default: Page, generateMetadata } = await import('../dashboard/enrollments/[id]/page')
      const props = () => ({ params: Promise.resolve({ locale: 'fr', id: a.enrollment.id }) })
      await generateMetadata(props())
      await Page(props())
    })

    it('class detail', async () => {
      const { default: Page, generateMetadata } = await import('../dashboard/classes/[id]/page')
      const props = () => ({ params: Promise.resolve({ locale: 'fr', id: a.classPeriod.id }) })
      await generateMetadata(props())
      await Page(props())
    })
  })

  describe('pages open to a parent', () => {
    beforeEach(() => {
      signIn(a.parent, a.school.id)
    })

    it('dashboard', async () => {
      const { default: Page } = await import('../dashboard/page')
      await Page({ params: params() })
    })

    it('students', async () => {
      const { default: Page } = await import('../dashboard/students/page')
      await Page({ params: params() })
    })

    it('enrollments', async () => {
      const { default: Page } = await import('../dashboard/enrollments/page')
      await Page({ params: params(), searchParams: Promise.resolve({}) })
    })

    it('family detail', async () => {
      const { default: Page } = await import('../dashboard/families/[id]/page')
      await Page({
        params: Promise.resolve({ locale: 'fr', id: a.family.id }),
        searchParams: Promise.resolve({}),
      })
    })

    it('student detail', async () => {
      const { default: Page } = await import('../dashboard/students/[id]/page')
      await Page({ params: Promise.resolve({ locale: 'fr', id: a.student.id }) })
    })

    it('enrollment detail', async () => {
      const { default: Page } = await import('../dashboard/enrollments/[id]/page')
      await Page({ params: Promise.resolve({ locale: 'fr', id: a.enrollment.id }) })
    })

    // Le détail de classe est réservé à l'administration : `resolveDeepLink`
    // s'arrête sur une liste d'écoles administrées vide, avant toute requête.
    it('gets notFound on the class detail, with no unscoped read', async () => {
      const { default: Page } = await import('../dashboard/classes/[id]/page')
      await expect(
        Page({ params: Promise.resolve({ locale: 'fr', id: a.classPeriod.id }) })
      ).rejects.toBeInstanceOf(NotFoundSentinel)
    })
  })

  // Garde alternée : l'élève de A est rattaché à `a.family` et à `a.otherFamily`. Le garde
  // de racine ouvre la fiche aux deux parents ; ce bloc vérifie que l'inclusion des
  // familles est bornée elle aussi, et que l'administrateur voit une famille déterministe.
  describe('student detail family scope, under shared custody', () => {
    async function familiesSeenOn(studentId: string) {
      const { resolveStudent } = await import('../dashboard/students/[id]/_lib/student-detail')
      const resolution = await resolveStudent(studentId)
      if (resolution.status !== 'found') throw new Error(`unexpected ${resolution.status}`)
      return resolution.resource.person.families.map((link) => link.familyId)
    }

    it('shows a parent only the household their account is linked to', async () => {
      signIn(a.parent, a.school.id)
      expect(await familiesSeenOn(a.student.id)).toEqual([a.family.id])

      signIn(a.otherParent, a.school.id)
      expect(await familiesSeenOn(a.student.id)).toEqual([a.otherFamily.id])
    })

    it('shows the admin every household and derives the debtor family', async () => {
      signIn(a.admin, a.school.id)
      const { deriveStudentDetail, resolveStudent } = await import(
        '../dashboard/students/[id]/_lib/student-detail'
      )

      const resolution = await resolveStudent(a.student.id)
      if (resolution.status !== 'found') throw new Error(`unexpected ${resolution.status}`)

      expect(resolution.resource.person.families.map((link) => link.familyId).sort()).toEqual(
        [a.family.id, a.otherFamily.id].sort()
      )
      const [debtorId] = [a.family.id, a.otherFamily.id].sort()
      expect(deriveStudentDetail(resolution.resource).family?.id).toBe(debtorId)
    })
  })

  describe('platform pages, as a super-admin', () => {
    beforeEach(() => {
      signIn(a.superAdmin, a.school.id)
    })

    it('schools', async () => {
      const { default: Page } = await import('../dashboard/schools/page')
      await Page({ params: params() })
    })

    it('dashboard', async () => {
      const { default: Page } = await import('../dashboard/page')
      await Page({ params: params() })
    })

    it('users', async () => {
      const { default: Page } = await import('../dashboard/users/page')
      await Page({ params: params() })
    })
  })
})
