import { Breadcrumbs, Card } from '@peaklab/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { EnrollmentStatusBadge } from '@/features/enums'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { requireSchoolAdmin } from '../../../_lib/auth-helper'
import { notFoundTitle } from '../../../_lib/page-metadata'
import { EditClassDialog } from '../_components/edit-class-dialog'

type Props = {
  params: Promise<{ locale: string; id: string }>
}

const ROSTER_STATUSES = ['PENDING', 'ACTIVE', 'COMPLETED'] as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  const { schoolId } = await requireSchoolAdmin()

  const classPeriod = await db.classPeriod.findUnique({
    where: { id_schoolId: { id, schoolId } },
    select: { name: true },
  })
  return { title: classPeriod?.name ?? (await notFoundTitle(locale)) }
}

export default async function ClassDetailPage({ params }: Props) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.classDetails')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { schoolId } = await requireSchoolAdmin()

  const classPeriod = await db.classPeriod.findUnique({
    where: { id_schoolId: { id, schoolId } },
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
    },
  })

  if (!classPeriod) notFound()

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
            }}
          />
        </div>
      </div>

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
          <Card className="overflow-hidden rounded-xl border border-gray-200">
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
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(row.startAt).toLocaleDateString(locale)}
                    </td>
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
