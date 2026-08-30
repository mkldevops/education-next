import { Breadcrumbs, buttonVariants, Card } from '@peaklab/ui'
import { CreditCard, HeartPulse, TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cache } from 'react'
import { getSelectedPeriodId } from '@/features/dashboard/period'
import { Link } from '@/i18n/routing'
import { formatDateLong } from '@/lib/date'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { isActiveSchoolAdmin } from '@/lib/school-context'
import { SchoolSwitchPrompt } from '../../../_components/school-switch-prompt'
import { requireSchoolSession } from '../../../_lib/auth-helper'
import { adminOrLinkedTo, resolveDeepLink } from '../../../_lib/deep-link'
import { deepLinkTitle } from '../../../_lib/page-metadata'
import { canSwitchSchool } from '../../../_lib/school-switch'
import { CreateEnrollmentDialog } from '../../enrollments/_components/create-enrollment-dialog'
import { DeactivateStudentButton } from '../_components/deactivate-student-button'
import { EditStudentDialog } from '../_components/edit-student-dialog'
import { EnrollmentList } from './_components/enrollment-list'
import { FamilyPanel } from './_components/family-panel'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

/**
 * Résolveur unique de la page ET de `generateMetadata`.
 *
 * Le rattachement parent passe par `UserFamily` plutôt que par le `familyId` de l'école
 * active : c'est la seule forme qui reste vraie quand la ressource vit dans une autre
 * école autorisée.
 */
const resolveStudent = cache((id: string) =>
  resolveDeepLink({
    requireAdmin: false,
    find: (access) =>
      db.student.findFirst({
        where: {
          id,
          schoolId: { in: access.schoolIds },
          ...adminOrLinkedTo(access, {
            person: {
              families: { some: { family: { users: { some: { userId: access.userId } } } } },
            },
          }),
        },
        include: {
          person: {
            include: {
              families: {
                include: {
                  family: {
                    include: {
                      persons: {
                        include: { person: { include: { phoneNumbers: true } } },
                      },
                    },
                  },
                },
              },
              phoneNumbers: true,
            },
          },
          enrollments: {
            where: { isActive: true },
            include: {
              plan: true,
              classAssignments: {
                include: {
                  classPeriod: {
                    include: {
                      period: true,
                      level: true,
                    },
                  },
                },
              },
              payments: { where: { isActive: true } },
            },
            orderBy: { registeredAt: 'desc' as const },
          },
        },
      }),
  })
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params
  await requireSchoolSession()

  return deepLinkTitle(
    locale,
    await resolveStudent(id),
    (student) => `${student.person.name} ${student.person.lastname}`
  )
}

export default async function StudentDetailPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.studentDetails')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const context = await requireSchoolSession()
  const resolution = await resolveStudent(id)

  if (resolution.status === 'notFound') notFound()
  if (resolution.status === 'otherSchool')
    return (
      <SchoolSwitchPrompt
        schoolId={resolution.school.id}
        schoolName={resolution.school.name}
        canSwitch={await canSwitchSchool()}
      />
    )

  const student = resolution.resource
  const isAdmin = isActiveSchoolAdmin(context)

  const selectedPeriodId = isAdmin ? await getSelectedPeriodId(student.schoolId) : null

  const [plans, classes] = isAdmin
    ? await Promise.all([
        db.plan.findMany({
          where: { schoolId: student.schoolId, isActive: true },
          orderBy: { name: 'asc' },
        }),
        db.classPeriod.findMany({
          where: {
            schoolId: student.schoolId,
            isActive: true,
            ...(selectedPeriodId ? { periodId: selectedPeriodId } : {}),
          },
          include: { level: true, period: true },
          orderBy: { name: 'asc' },
        }),
      ])
    : [[], []]

  const fullName = `${student.person.name} ${student.person.lastname}`
  const family = student.person.families[0]?.family ?? null
  const birthday = new Date(student.birthday)
  const age = Math.floor((Date.now() - birthday.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

  const totalDue = student.enrollments.reduce((sum, e) => sum + Number(e.totalAmount), 0)
  const totalPaid = student.enrollments.reduce(
    (sum, e) => sum + e.payments.reduce((acc, p) => acc + Number(p.amount), 0),
    0
  )
  const remaining = Math.max(0, totalDue - totalPaid)
  const activeEnrollments = student.enrollments.filter((e) => e.status === 'ACTIVE')
  const payableRemaining = activeEnrollments.reduce(
    (sum, e) =>
      sum + Number(e.totalAmount) - e.payments.reduce((paid, p) => paid + Number(p.amount), 0),
    0
  )

  const languagesAtHome = Array.isArray(student.languagesAtHome)
    ? student.languagesAtHome.join(', ')
    : ''

  const infoRows = [
    { label: t('birthplace'), value: student.birthplace },
    { label: t('email'), value: student.person.email },
    { label: t('address'), value: student.person.address },
    { label: t('languagesAtHome'), value: languagesAtHome },
    { label: t('previousSchool'), value: student.previousSchool },
    {
      label: t('snackAuthorization'),
      value: student.snackAuthorization ? t('yes') : t('no'),
    },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value))

  const kpis = [
    { label: t('kpis.activeEnrollments'), value: String(activeEnrollments.length) },
    { label: t('kpis.totalDue'), value: formatCurrency(totalDue, locale) },
    {
      label: t('kpis.totalPaid'),
      value: formatCurrency(totalPaid, locale),
      tone: totalPaid > 0 ? 'emerald' : undefined,
    },
    {
      label: t('kpis.remaining'),
      value: formatCurrency(remaining, locale),
      tone: remaining > 0 ? 'amber' : undefined,
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          {
            label: tBreadcrumbs('dashboard'),
            href: '/dashboard',
            icon: 'home',
          },
          family
            ? {
                label: family.name,
                href: `/dashboard/families/${family.id}`,
              }
            : { label: tBreadcrumbs('students'), href: '/dashboard/students' },
          { label: fullName },
        ]}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-900">
            {student.person.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-gray-900" title={fullName}>
              {fullName}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {t('age', { age })}
              <span className="mx-2 text-gray-300">·</span>
              {formatDateLong(birthday, locale)}
              {student.birthplace && (
                <>
                  <span className="mx-2 text-gray-300">·</span>
                  {student.birthplace}
                </>
              )}
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-2">
            {family && payableRemaining > 0 && (
              <Link
                href={`/dashboard/families/${family.id}?action=addPayment&tab=payments`}
                className={buttonVariants({ size: 'sm' })}
              >
                <CreditCard className="h-4 w-4" />
                {t('pay')}
              </Link>
            )}
            <EditStudentDialog
              student={{
                id: student.id,
                birthday: student.birthday,
                birthplace: student.birthplace,
                allergies: student.allergies,
                healthNotes: student.healthNotes,
                languagesAtHome: student.languagesAtHome,
                snackAuthorization: student.snackAuthorization,
              }}
            />
            <DeactivateStudentButton studentId={student.id} />
          </div>
        )}
      </div>

      {(student.allergies || student.healthNotes) && (
        <div className="grid gap-3 md:grid-cols-2">
          {student.allergies && (
            <div className="flex gap-3 rounded border border-red-200 bg-red-50 p-4">
              <TriangleAlert className="h-5 w-5 shrink-0 text-red-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-900">{t('allergies')}</p>
                <p className="mt-0.5 text-sm text-red-800">{student.allergies}</p>
              </div>
            </div>
          )}
          {student.healthNotes && (
            <div className="flex gap-3 rounded border border-amber-200 bg-amber-50 p-4">
              <HeartPulse className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900">{t('healthNotes')}</p>
                <p className="mt-0.5 text-sm text-amber-800">{student.healthNotes}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{kpi.label}</p>
            <p
              className={`mt-1 text-xl font-semibold tabular-nums ${
                kpi.tone === 'amber'
                  ? 'text-amber-600'
                  : kpi.tone === 'emerald'
                    ? 'text-emerald-600'
                    : 'text-gray-900'
              }`}
            >
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">{t('enrollments')}</h2>
            {isAdmin && (
              <CreateEnrollmentDialog
                students={[{ id: student.id, name: fullName }]}
                plans={plans.map((p) => ({ id: p.id, name: p.name }))}
                classes={classes.map((c) => ({
                  id: c.id,
                  name: `${c.name} (${c.level.name} — ${c.period.name})`,
                }))}
                defaultStudentId={student.id}
                redirectTo={`/dashboard/students/${student.id}`}
                triggerSize="sm"
              />
            )}
          </div>
          <EnrollmentList enrollments={student.enrollments} locale={locale} />
        </div>

        <div className="space-y-4">
          <FamilyPanel family={family} />

          {infoRows.length > 0 && (
            <Card className="p-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('information')}
              </h2>
              <dl className="mt-3 space-y-3">
                {infoRows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs text-gray-500">{row.label}</dt>
                    <dd className="mt-0.5 text-sm text-gray-900">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
