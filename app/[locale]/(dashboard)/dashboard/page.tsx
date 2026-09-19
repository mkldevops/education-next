import { Card, type Column, DataTable, ProgressBar, StatusBadge, StatusDot } from '@peaklab/ui'
import { AlertCircle, Plus, TrendingUp, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolGateway } from '@/gateways/school-gateway'
import { Link, redirect } from '@/i18n/routing'
import { auth } from '@/lib/auth'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { getSchoolContext } from '@/lib/school-context'
import { isStripeConfigured } from '@/lib/stripe'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { isEventsEnabled } from '@/use-cases/events/is-events-enabled'
import { requireSchoolScope } from '../_lib/auth-helper'
import { SchoolInsightsSection } from './_components/school-insights'
import { StudentTrendCard } from './_components/student-trend-card'
import { UnlinkedParentNotice } from './_components/unlinked-parent-notice'
import { UpcomingEventsCard } from './_components/upcoming-events-card'
import { getDashboardOverview } from './_lib/dashboard-overview'
import { ActivateEnrollmentButton } from './families/[id]/_components/activate-enrollment-button'
import { OnlinePaymentButton } from './families/[id]/_components/online-payment-button'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: t('title'),
  }
}

export default async function DashboardPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard')
  const tStatus = await getTranslations('status')

  const session = await auth.api.getSession({ headers: await headers() })

  const context = await getSchoolContext()
  if (!context?.isSuperAdmin && context?.role === 'TEACHER') {
    redirect({ href: '/dashboard/my-classes', locale })
  }
  if (context?.role === 'PARENT' && !context.familyId) {
    const school = await schoolGateway.findActiveById(context.schoolId)
    return (
      <UnlinkedParentNotice userName={session?.user.name ?? null} schoolName={school?.name ?? ''} />
    )
  }

  const scope = await requireSchoolScope()
  const [paymentsEnabled, eventsEnabled, activeSchool] = await Promise.all([
    isPaymentsEnabled(scope.schoolId),
    isEventsEnabled(scope.schoolId),
    schoolGateway.findActiveById(scope.schoolId),
  ])
  const schoolName = activeSchool?.name ?? ''

  const isAdmin = scope.isAdmin

  const {
    selectedPeriod,
    familyCount,
    studentCount,
    enrollmentCount,
    pendingPaymentCount,
    recentEnrollments,
    parentBalance,
    insights,
    recentStudents,
  } = await getDashboardOverview(scope, paymentsEnabled)
  type RecentEnrollment = (typeof recentEnrollments)[number]

  const trendStart = new Date()
  trendStart.setDate(1)
  trendStart.setMonth(trendStart.getMonth() - 5)
  const monthlyAdds = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(trendStart.getFullYear(), trendStart.getMonth() + index, 1)
    return {
      label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(month),
      count: recentStudents.filter(
        (student) =>
          student.createdAt.getFullYear() === month.getFullYear() &&
          student.createdAt.getMonth() === month.getMonth()
      ).length,
    }
  })
  let runningStudents = studentCount - monthlyAdds.reduce((sum, month) => sum + month.count, 0)
  const studentTrend = monthlyAdds.map((month) => {
    runningStudents += month.count
    return { label: month.label, value: runningStudents }
  })

  const periodScope = selectedPeriod
    ? t('stats.scopePeriod', { period: selectedPeriod.name })
    : t('stats.scopeAll')

  const userName = session?.user.name || 'User'
  const enrollmentColumns: Column<RecentEnrollment>[] = [
    {
      key: 'student',
      header: t('table.student'),
      render: (item) => (
        <Link
          href={`/dashboard/students/${item.student.id}`}
          className="font-medium text-primary hover:text-primary-hover"
        >
          {item.student.person.name} {item.student.person.lastname}
        </Link>
      ),
    },
    ...(paymentsEnabled
      ? [
          {
            key: 'plan',
            header: t('table.plan'),
            className: 'text-graphite-600',
            render: (item) =>
              item.plan.name === UNPRICED_PLAN_NAME ? (
                <StatusBadge status="amber" label={t('pages.enrollments.unpriced.badge')} />
              ) : (
                item.plan.name
              ),
          } satisfies Column<RecentEnrollment>,
        ]
      : []),
    {
      key: 'class',
      header: t('table.class'),
      className: 'text-graphite-600',
      render: (item) => {
        const current = item.classAssignments.find((assignment) => !assignment.endAt)
        if (!current) return '—'
        // La page classe est réservée aux admins : un parent n'y obtiendrait qu'un 404.
        if (!isAdmin) return current.classPeriod.level.name
        return (
          <Link
            href={`/dashboard/classes/${current.classPeriod.id}`}
            className="text-primary hover:text-primary-hover"
          >
            {current.classPeriod.level.name}
          </Link>
        )
      },
    },
    {
      key: 'status',
      header: t('table.status'),
      render: (item) => (
        <StatusDot
          color={item.status === 'ACTIVE' ? 'green' : 'amber'}
          label={tStatus(item.status)}
        />
      ),
    },
    ...(paymentsEnabled
      ? [
          {
            key: 'payment',
            header: t('table.payment'),
            render: (item) => {
              const finalAmount = Number(item.totalAmount)
              const totalPaid = (item.payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
              const ratio = finalAmount > 0 ? (totalPaid / finalAmount) * 100 : 0
              return <ProgressBar value={ratio} />
            },
          } satisfies Column<RecentEnrollment>,
        ]
      : []),
    {
      key: 'date',
      header: t('table.date'),
      className: 'text-graphite-600',
      render: (item) => formatDate(item.registeredAt, locale),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (item) =>
              item.status === 'PENDING' ? (
                <ActivateEnrollmentButton enrollmentId={item.id} />
              ) : null,
          } satisfies Column<RecentEnrollment>,
        ]
      : []),
  ]

  const statsGridClassName = isAdmin
    ? paymentsEnabled
      ? '-mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4'
      : '-mt-14 grid gap-5 md:grid-cols-3'
    : paymentsEnabled
      ? '-mt-14 grid gap-5 md:grid-cols-3'
      : '-mt-14 grid gap-5 md:grid-cols-2'

  return (
    <div className="space-y-8">
      <div className="-mx-6 -mt-16 bg-gradient-to-br from-primary-light via-primary-light/50 to-alabaster-800 px-6 pb-20 pt-16">
        <h1 className="text-3xl font-bold text-graphite">{t('greeting', { name: userName })}</h1>
        <p className="mt-2 text-graphite-600">
          {t(isAdmin ? 'greetingSubtitle' : 'parentGreetingSubtitle', { schoolName })}
        </p>

        {isAdmin && (
          <div className="mt-6">
            <Link
              href="/dashboard/families?action=create"
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-primary-hover"
            >
              <Plus className="h-5 w-5" />
              {t('quickActions.newFamily')}
            </Link>
          </div>
        )}
      </div>

      <div className={statsGridClassName}>
        {isAdmin && insights?.payments && (
          <Card className="rounded border border-amber-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-graphite-600">{t('insights.remaining')}</p>
                <p className="mt-2 text-3xl font-bold text-graphite">
                  {formatCurrency(insights.payments.totals.remaining, locale)}
                </p>
                <p className="mt-1 text-xs text-graphite-600">
                  {t('insights.familiesCount', { count: familyCount })}
                </p>
              </div>
              <div className="rounded bg-amber-100 p-3">
                <Wallet className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </Card>
        )}
        <StudentTrendCard
          title={t('stats.students')}
          subtitle={t('stats.lastSixMonths')}
          total={studentCount}
          points={studentTrend}
        />
        <Card className="rounded border border-alabaster-700 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-graphite-600">{t('stats.enrollments')}</p>
              <p className="mt-2 text-3xl font-bold text-graphite">{enrollmentCount}</p>
              <p className="mt-1 text-xs text-graphite-600">{periodScope}</p>
            </div>
            <div className="rounded bg-primary-light p-3">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>
        {isAdmin ? (
          <Card className="rounded border border-alabaster-700 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-graphite-600">
                  {t('stats.pendingEnrollments')}
                </p>
                <p className="mt-2 text-3xl font-bold text-graphite">{pendingPaymentCount}</p>
                <p className="mt-1 text-xs text-graphite-600">{periodScope}</p>
              </div>
              <div className="rounded bg-amber-100 p-3">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </Card>
        ) : (
          paymentsEnabled && (
            <Card className="rounded border border-amber-200 bg-white p-5">
              <p className="text-sm font-medium text-graphite-600">{t('stats.remainingBalance')}</p>
              <p className="mt-2 text-3xl font-bold text-graphite">
                {formatCurrency(parentBalance?.remainingBalance ?? 0, locale)}
              </p>
              <p className="mt-1 text-xs text-graphite-600">{t('stats.scopeAll')}</p>
              <div className="mt-4">
                <OnlinePaymentButton
                  amount={parentBalance?.remainingBalance ?? 0}
                  configured={isStripeConfigured()}
                  locale={locale}
                />
              </div>
            </Card>
          )
        )}
      </div>

      {insights && <SchoolInsightsSection insights={insights} locale={locale} />}

      {eventsEnabled && (
        <UpcomingEventsCard
          schoolId={scope.schoolId}
          viewer={isAdmin ? 'STAFF' : 'MEMBER'}
          locale={locale}
          canManage={isAdmin}
        />
      )}

      <Card className="rounded border border-alabaster-700">
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="text-lg font-semibold text-graphite">{t('recentEnrollments')}</h2>
          <Link
            href={isAdmin ? '/dashboard/enrollments' : `/dashboard/families/${scope.familyId}`}
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            {t(isAdmin ? 'viewAll' : 'viewFamily')}
          </Link>
        </div>

        {recentEnrollments.length === 0 ? (
          <p className="px-6 pb-6 pt-4 text-graphite-600">
            {selectedPeriod
              ? t('pages.enrollments.noEnrollmentsInPeriod', { period: selectedPeriod.name })
              : t('pages.enrollments.noEnrollments')}
          </p>
        ) : (
          <div className="mt-4">
            <DataTable
              data={recentEnrollments}
              columns={enrollmentColumns}
              getRowKey={(item) => item.id}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
