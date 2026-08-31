import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cache } from 'react'
import { EnrollmentStatusBadge } from '@/features/enums'
import { Link } from '@/i18n/routing'
import { formatDate } from '@/lib/date'
import { db } from '@/lib/db'
import { SchoolSwitchPrompt } from '../../../_components/school-switch-prompt'
import { requireSchoolSession } from '../../../_lib/auth-helper'
import { resolveDeepLink } from '../../../_lib/deep-link'
import { deepLinkTitle } from '../../../_lib/page-metadata'
import { canSwitchSchool } from '../../../_lib/school-switch'
import { EditClassDialog } from '../_components/edit-class-dialog'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

const ROSTER_STATUSES = ['PENDING', 'ACTIVE', 'COMPLETED'] as const

/**
 * Résolveur unique de la page ET de `generateMetadata`.
 *
 * `requireAdmin` restreint la recherche aux écoles réellement administrées : un parent
 * d'une autre école ne doit pas se voir proposer la bascule vers une classe.
 */
const resolveClass = cache((id: string) =>
  resolveDeepLink({
    requireAdmin: true,
    find: (access) =>
      db.classPeriod.findFirst({
        where: { id, schoolId: { in: access.schoolIds } },
        include: {
          level: true,
          period: true,
          classAssignments: {
            where: { endAt: null, enrollment: { status: { in: [...ROSTER_STATUSES] } } },
            include: {
              enrollment: {
                include: {
                  plan: { select: { name: true } },
                  student: { include: { person: true } },
                },
              },
            },
          },
          teachers: {
            where: { teacher: { isActive: true } },
            include: { teacher: true },
          },
        },
      }),
  })
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  await requireSchoolSession()

  return deepLinkTitle(locale, await resolveClass(id), (classPeriod) => classPeriod.name)
}

export default async function ClassDetailPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.classDetails')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  await requireSchoolSession()
  const resolution = await resolveClass(id)

  if (resolution.status === 'notFound') notFound()
  if (resolution.status === 'otherSchool')
    return (
      <SchoolSwitchPrompt
        schoolId={resolution.school.id}
        schoolName={resolution.school.name}
        canSwitch={await canSwitchSchool()}
      />
    )

  const classPeriod = resolution.resource
  const teachers = await db.teacher.findMany({
    where: { schoolId: classPeriod.schoolId, isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  const teacherOptions = teachers.map((teacher) => ({
    id: teacher.id,
    name: `${teacher.lastName} ${teacher.firstName}`,
  }))
  const assignedTeachers = classPeriod.teachers.map(({ teacher }) => ({
    id: teacher.id,
    name: `${teacher.lastName} ${teacher.firstName}`,
  }))

  const roster = classPeriod.classAssignments
    .map((assignment) => ({
      assignmentId: assignment.id,
      startAt: assignment.startAt,
      enrollmentId: assignment.enrollment.id,
      status: assignment.enrollment.status,
      planName: assignment.enrollment.plan.name,
      studentId: assignment.enrollment.student.id,
      studentName: `${assignment.enrollment.student.person.name} ${assignment.enrollment.student.person.lastname}`,
    }))
    .sort((a, b) => a.studentName.localeCompare(b.studentName, locale))

  const seatsLeft = Math.max(0, classPeriod.capacity - roster.length)

  const kpis = [
    { label: t('kpis.enrolled'), value: String(roster.length) },
    { label: t('kpis.capacity'), value: String(classPeriod.capacity) },
    {
      label: t('kpis.seatsLeft'),
      value: String(seatsLeft),
      tone: seatsLeft === 0 ? 'amber' : undefined,
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('classes'), href: '/dashboard/classes' },
          { label: classPeriod.name },
        ]}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-900">{classPeriod.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {classPeriod.level.name}
            <span className="mx-2 text-gray-300">·</span>
            {classPeriod.period.name}
          </p>
        </div>
        <div className="shrink-0">
          <EditClassDialog
            classItem={{
              id: classPeriod.id,
              name: classPeriod.name,
              capacity: classPeriod.capacity,
              teacherIds: classPeriod.teachers.map(({ teacherId }) => teacherId),
            }}
            teachers={teacherOptions}
          />
        </div>
      </div>

      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('teachers')}</p>
        {assignedTeachers.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {assignedTeachers.map((teacher) => (
              <span
                key={teacher.id}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800"
              >
                {teacher.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">{t('noTeachers')}</p>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{kpi.label}</p>
            <p
              className={`mt-1 text-xl font-semibold tabular-nums ${
                kpi.tone === 'amber' ? 'text-amber-600' : 'text-gray-900'
              }`}
            >
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">{t('roster')}</h2>
        {roster.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-gray-500">{t('noStudents')}</p>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded border border-gray-200">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">{t('student')}</th>
                  <th className="px-4 py-3">{t('plan')}</th>
                  <th className="px-4 py-3">{t('status')}</th>
                  <th className="px-4 py-3">{t('since')}</th>
                  <th className="px-4 py-3 text-right">{t('enrollment')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roster.map((row) => (
                  <tr key={row.assignmentId} className="text-sm">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/students/${row.studentId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.planName}</td>
                    <td className="px-4 py-3">
                      <EnrollmentStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(row.startAt, locale)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/enrollments/${row.enrollmentId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {t('openEnrollment')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  )
}
