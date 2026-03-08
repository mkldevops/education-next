import { Breadcrumbs, Card, type Column, DataTable, StatusBadge } from '@peaklab/ui'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { db } from '@/lib/db'
import { formatAmount } from '@/lib/decimal'
import { getSessionWithRole } from '../../_lib/auth-helper'
import { CreateEnrollmentDialog } from './_components/create-enrollment-dialog'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ action?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('pages.enrollments.title'),
  }
}

export default async function EnrollmentsPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { action } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.enrollments')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')

  const { role, familyId } = await getSessionWithRole()

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  const whereStudent = isAdmin
    ? {}
    : {
        person: {
          families: {
            some: { familyId },
          },
        },
      }

  const [students, plans, classes] = isAdmin
    ? await Promise.all([
        db.student.findMany({
          where: { isActive: true },
          include: { person: true },
          orderBy: { person: { lastname: 'asc' } },
        }),
        db.plan.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
        db.classPeriod.findMany({
          where: { isActive: true },
          include: { level: true, period: true },
          orderBy: { name: 'asc' },
        }),
      ])
    : [[], [], []]

  const studentOptions = students.map((s) => ({
    id: s.id,
    name: `${s.person.lastname} ${s.person.name}`,
  }))
  const planOptions = plans.map((p) => ({ id: p.id, name: p.name }))
  const classOptions = classes.map((c) => ({
    id: c.id,
    name: `${c.name} (${c.level.name} — ${c.period.name})`,
  }))

  const enrollments = await db.enrollment.findMany({
    where: { isActive: true, student: whereStudent },
    include: {
      student: {
        include: {
          person: true,
        },
      },
      plan: true,
      classAssignments: {
        where: { endAt: null },
        include: {
          classPeriod: true,
        },
      },
    },
    orderBy: { registeredAt: 'desc' },
  })

  const columns: Column<(typeof enrollments)[0]>[] = [
    {
      key: 'student',
      header: t('student'),
      render: (enrollment) => (
        <Link
          href={`/dashboard/enrollments/${enrollment.id}`}
          className="text-primary hover:text-primary-hover font-medium"
        >
          {enrollment.student.person.name} {enrollment.student.person.lastname}
        </Link>
      ),
    },
    {
      key: 'plan',
      header: t('plan'),
      className: 'text-gray-700',
      render: (enrollment) => enrollment.plan.name,
    },
    {
      key: 'status',
      header: t('status'),
      render: (enrollment) => <StatusBadge status={enrollment.status} />,
    },
    {
      key: 'class',
      header: t('class'),
      className: 'text-gray-700',
      render: (enrollment) =>
        enrollment.classAssignments.length > 0
          ? enrollment.classAssignments[0].classPeriod.name
          : '-',
    },
    {
      key: 'totalAmount',
      header: t('totalAmount'),
      className: 'text-gray-700',
      render: (enrollment) => `€${formatAmount(enrollment.totalAmount)}`,
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('enrollments') },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {studentOptions.length > 0 && planOptions.length > 0 && classOptions.length > 0 && (
          <CreateEnrollmentDialog
            students={studentOptions}
            plans={planOptions}
            classes={classOptions}
            defaultOpen={action === 'create'}
          />
        )}
      </div>
      <Card className="rounded-xl border border-gray-200">
        <DataTable
          data={enrollments}
          columns={columns}
          getRowKey={(enrollment) => enrollment.id}
          emptyMessage={t('noEnrollments')}
        />
      </Card>
    </div>
  )
}
