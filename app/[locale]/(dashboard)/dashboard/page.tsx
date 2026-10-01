import {
  buttonVariants,
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatusBadge,
  StatusDot,
} from '@peaklab/ui'
import {
  BadgeCheck,
  CalendarClock,
  CalendarX2,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  HandCoins,
  Landmark,
  Plus,
  Users,
  Wallet,
} from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { totalPaidAmount } from '@/domain/payment'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { configGateway } from '@/gateways/config-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import { Link, redirect } from '@/i18n/routing'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { auth } from '@/lib/auth'
import { formatDate } from '@/lib/date'
import { formatCurrency } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { getSchoolContext } from '@/lib/school-context'
import { isClassScheduleEnabled } from '@/use-cases/class-schedules/is-class-schedule-enabled'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { isEventsEnabled } from '@/use-cases/events/is-events-enabled'
import { isOnlinePaymentAvailable } from '@/use-cases/payments/stripe-settings'
import { requireSchoolScope } from '../_lib/auth-helper'
import { KpiCard, Panel, PanelLink, TaskRow } from './_components/home-widgets'
import { SchoolInsightsSection } from './_components/school-insights'
import { UnlinkedParentNotice } from './_components/unlinked-parent-notice'
import { UpcomingEventsCard } from './_components/upcoming-events-card'
import { getDashboardOverview } from './_lib/dashboard-overview'
import { getParentHome } from './_lib/parent-home'
import { getTodayAgenda } from './_lib/today-agenda'
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

/** Même lecture que la page d'appel : le drapeau vit dans `config`, borné par l'école. */
async function isAttendanceEnabled(schoolId: string) {
  const config = await configGateway.get(schoolId, ATTENDANCE_ENABLED_CONFIG_KEY)
  return readsAsOptedIn(config?.value)
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}

const ATTENDANCE_BADGE = {
  NOT_STARTED: { status: 'gray', label: 'notStarted' },
  IN_PROGRESS: { status: 'amber', label: 'inProgress' },
  VALIDATED: { status: 'green', label: 'validated' },
} as const

export default async function DashboardPage({ params }: Props) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard')
  const tStatus = await getTranslations('status')
  const tAttendance = await getTranslations('dashboard.pages.attendance')

  const session = await auth.api.getSession({ headers: await headers() })

  const context = await getSchoolContext()
  if (!context?.isSuperAdmin && context?.role === 'TEACHER') {
    redirect({ href: '/dashboard/my-classes', locale })
  }
  // Refus avant toute lecture de données familiales : sans famille liée, rien à borner.
  if (context?.role === 'PARENT' && !context.familyId) {
    const school = await schoolGateway.findActiveById(context.schoolId)
    return (
      <UnlinkedParentNotice userName={session?.user.name ?? null} schoolName={school?.name ?? ''} />
    )
  }

  const scope = await requireSchoolScope()
  const [paymentsEnabled, eventsEnabled, scheduleEnabled, attendanceEnabled, activeSchool] =
    await Promise.all([
      isPaymentsEnabled(scope.schoolId),
      isEventsEnabled(scope.schoolId),
      isClassScheduleEnabled(scope.schoolId),
      isAttendanceEnabled(scope.schoolId),
      schoolGateway.findActiveById(scope.schoolId),
    ])
  const schoolName = activeSchool?.name ?? ''
  const userName = session?.user.name?.trim()
  const greeting = userName ? t('greeting', { name: userName }) : t('greetingNoName')
  const today = capitalize(
    new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date()
    )
  )
  const subtitle = schoolName ? `${today} · ${schoolName}` : today

  const eventsCard = eventsEnabled && (
    <UpcomingEventsCard
      schoolId={scope.schoolId}
      viewer={scope.isAdmin ? 'STAFF' : 'MEMBER'}
      locale={locale}
      canManage={scope.isAdmin}
    />
  )

  if (!scope.isAdmin) {
    const [selectedPeriod, onlinePaymentAvailable] = await Promise.all([
      getSelectedPeriod(scope.schoolId),
      isOnlinePaymentAvailable(scope.schoolId),
    ])
    const home = await getParentHome(scope.schoolId, scope.familyId, {
      periodId: selectedPeriod?.id ?? null,
      paymentsEnabled,
      scheduleEnabled,
    })
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })
    const familyHref = `/dashboard/families/${scope.familyId}`

    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          title={greeting}
          description={t('parentGreetingSubtitle', { schoolName })}
          actions={
            <Link href={familyHref} className={buttonVariants({ variant: 'outline' })}>
              {t('viewFamily')}
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <section aria-labelledby="children-heading" className="space-y-3 lg:col-span-2">
            <h2 id="children-heading" className="text-sm font-semibold text-foreground">
              {t('home.children.title')}
            </h2>
            {home.children.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t('home.children.empty')}
                description={t('home.children.emptyHint')}
                action={
                  <Link href={familyHref} className={buttonVariants({ variant: 'outline' })}>
                    {t('viewFamily')}
                  </Link>
                }
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {home.children.map((child) => (
                  <li
                    key={child.id}
                    className="rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-semibold text-foreground"
                      >
                        {`${child.firstName.charAt(0)}${child.lastName.charAt(0)}`.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {child.firstName} {child.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {child.levelName ?? t('home.children.noLevel')}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">{t('home.children.class')}</dt>
                        <dd className="truncate font-medium text-foreground">
                          {child.className ?? t('home.children.noClass')}
                        </dd>
                      </div>
                      {scheduleEnabled && (
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground">{t('home.children.nextClass')}</dt>
                          <dd className="text-right font-medium text-foreground tabular-nums">
                            {child.nextClass
                              ? `${
                                  child.nextClass.daysAhead === 0
                                    ? t('home.children.today')
                                    : child.nextClass.daysAhead === 1
                                      ? t('home.children.tomorrow')
                                      : capitalize(weekday.format(child.nextClass.date))
                                } · ${child.nextClass.startTime}–${child.nextClass.endTime}`
                              : t('home.children.noNextClass')}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-6">
            {home.remainingBalance !== null && (
              <section
                aria-labelledby="balance-heading"
                className="rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 id="balance-heading" className="text-sm font-medium text-muted-foreground">
                    {t('stats.remainingBalance')}
                  </h2>
                  <Wallet size={16} aria-hidden="true" className="text-muted-foreground" />
                </div>
                <p className="mt-3 text-right text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {formatCurrency(home.remainingBalance, locale)}
                </p>
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {t('stats.scopeAll')}
                </p>
                <div className="mt-4">
                  <OnlinePaymentButton
                    amount={home.remainingBalance}
                    configured={onlinePaymentAvailable}
                    locale={locale}
                  />
                </div>
              </section>
            )}
            {eventsCard}
          </div>
        </div>
      </div>
    )
  }

  const overview = await getDashboardOverview(scope.schoolId, paymentsEnabled)
  const {
    selectedPeriod,
    familyCount,
    studentCount,
    enrollmentCount,
    pendingEnrollmentCount,
    recentEnrollments,
    insights,
  } = overview
  const agenda = await getTodayAgenda(scope.schoolId, {
    periodId: selectedPeriod?.id ?? null,
    attendanceEnabled,
    scheduleEnabled,
  })
  const totals = insights.payments?.totals ?? null
  type RecentEnrollment = (typeof recentEnrollments)[number]

  const periodScope = selectedPeriod
    ? t('stats.scopePeriod', { period: selectedPeriod.name })
    : t('stats.scopeAll')

  const tasks = [
    agenda && agenda.attendanceToTake > 0
      ? {
          key: 'attendance',
          href: '/dashboard/attendance',
          icon: ClipboardCheck,
          tone: 'info' as const,
          title: t('home.todo.attendance', { count: agenda.attendanceToTake }),
          hint: t('home.todo.attendanceHint'),
        }
      : null,
    pendingEnrollmentCount > 0
      ? {
          key: 'enrollments',
          href: '/dashboard/enrollments',
          icon: ClipboardList,
          tone: 'warning' as const,
          title: t('home.todo.pendingEnrollments', { count: pendingEnrollmentCount }),
          hint: periodScope,
        }
      : null,
    totals && totals.uncashedCount > 0
      ? {
          key: 'uncashed',
          href: '/dashboard/payments',
          icon: Landmark,
          tone: 'neutral' as const,
          title: t('home.todo.uncashed', { count: totals.uncashedCount }),
          hint: t('home.todo.uncashedHint', {
            amount: formatCurrency(totals.uncashedAmount, locale),
          }),
        }
      : null,
    totals && totals.outstandingCount > 0
      ? {
          key: 'outstanding',
          href: '/dashboard/payments',
          icon: HandCoins,
          tone: 'danger' as const,
          title: t('home.todo.outstanding', { count: totals.outstandingCount }),
          hint: t('home.todo.outstandingHint', {
            amount: formatCurrency(totals.remaining, locale),
          }),
        }
      : null,
  ].filter((task) => task !== null)

  const enrollmentColumns: Column<RecentEnrollment>[] = [
    {
      key: 'student',
      header: t('table.student'),
      render: (item) => (
        <Link
          href={`/dashboard/students/${item.student.id}`}
          className="font-medium text-foreground hover:underline"
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
            className: 'text-muted-foreground',
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
      className: 'text-muted-foreground',
      render: (item) => {
        const current = item.classAssignments.find((assignment) => !assignment.endAt)
        if (!current) return '—'
        return (
          <Link
            href={`/dashboard/classes/${current.classPeriod.id}`}
            className="text-foreground hover:underline"
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
              const totalPaid = totalPaidAmount(item.payments ?? [])
              const ratio = finalAmount > 0 ? (totalPaid / finalAmount) * 100 : 0
              return <ProgressBar value={ratio} />
            },
          } satisfies Column<RecentEnrollment>,
        ]
      : []),
    {
      key: 'date',
      header: t('table.date'),
      className: 'text-muted-foreground tabular-nums',
      render: (item) => formatDate(item.registeredAt, locale),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (item) =>
        item.status === 'PENDING' ? <ActivateEnrollmentButton enrollmentId={item.id} /> : null,
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={greeting}
        description={subtitle}
        actions={
          <Link href="/dashboard/families?action=create" className={buttonVariants()}>
            <Plus size={16} aria-hidden="true" />
            {t('quickActions.newFamily')}
          </Link>
        }
      />

      <section aria-label={t('home.kpi.label')}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard
            href="/dashboard/families"
            label={t('stats.families')}
            value={familyCount}
            hint={t('stats.scopeAll')}
            icon={Users}
          />
          <KpiCard
            href="/dashboard/students"
            label={t('stats.students')}
            value={studentCount}
            hint={t('stats.scopeAll')}
            icon={GraduationCap}
          />
          <KpiCard
            href="/dashboard/enrollments"
            label={t('stats.enrollments')}
            value={enrollmentCount}
            hint={periodScope}
            icon={ClipboardList}
          />
          {totals ? (
            <KpiCard
              href="/dashboard/payments"
              label={t('insights.remaining')}
              value={formatCurrency(totals.remaining, locale)}
              hint={t('home.kpi.collectionRate', { rate: Math.round(totals.collectionRate) })}
              icon={Wallet}
            />
          ) : (
            <KpiCard
              href="/dashboard/enrollments"
              label={t('stats.pendingEnrollments')}
              value={pendingEnrollmentCount}
              hint={periodScope}
              icon={CalendarClock}
            />
          )}
        </div>
      </section>

      <div className={agenda ? 'grid gap-6 lg:grid-cols-5' : 'grid gap-6'}>
        <Panel
          id="todo-heading"
          title={t('home.todo.title')}
          className={agenda ? 'lg:col-span-3' : undefined}
        >
          {tasks.length === 0 ? (
            <EmptyState
              icon={BadgeCheck}
              title={t('home.todo.empty')}
              description={t('home.todo.emptyHint')}
              className="border-0 py-8"
              action={
                <Link
                  href="/dashboard/enrollments"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {t('home.todo.emptyAction')}
                </Link>
              }
            />
          ) : (
            <ul className="space-y-0.5">
              {tasks.map(({ key, ...task }) => (
                <TaskRow key={key} {...task} />
              ))}
            </ul>
          )}
        </Panel>

        {agenda && (
          <Panel
            id="today-classes-heading"
            title={t('home.schedule.title')}
            className="lg:col-span-2"
            action={
              <PanelLink href={attendanceEnabled ? '/dashboard/attendance' : '/dashboard/planning'}>
                {attendanceEnabled ? t('home.schedule.openAttendance') : t('home.schedule.viewAll')}
              </PanelLink>
            }
          >
            {agenda.closed && (
              <p className="mx-1 mb-2 flex items-center gap-2 rounded-md bg-warning-subtle px-3 py-2 text-xs font-medium text-warning">
                <CalendarX2 size={14} aria-hidden="true" />
                {t('home.schedule.closed')}
              </p>
            )}
            {agenda.classes.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={t('home.schedule.empty')}
                className="border-0 py-8"
                action={
                  <Link
                    href={scheduleEnabled ? '/dashboard/planning' : '/dashboard/attendance'}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    {scheduleEnabled
                      ? t('home.schedule.viewAll')
                      : t('home.schedule.openAttendance')}
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {agenda.classes.map((item) => (
                  <li key={item.slotId} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                      {item.startTime}–{item.endTime}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {item.className}
                      </span>
                      {item.teachers.length > 0 && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.teachers.join(', ')}
                        </span>
                      )}
                    </span>
                    {item.attendance && (
                      <StatusBadge
                        status={ATTENDANCE_BADGE[item.attendance].status}
                        label={tAttendance(ATTENDANCE_BADGE[item.attendance].label)}
                        className="shrink-0"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      <SchoolInsightsSection insights={insights} locale={locale} />

      {eventsCard}

      <Panel
        id="recent-enrollments-heading"
        title={t('recentEnrollments')}
        action={<PanelLink href="/dashboard/enrollments">{t('viewAll')}</PanelLink>}
      >
        {recentEnrollments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={
              selectedPeriod
                ? t('pages.enrollments.noEnrollmentsInPeriod', { period: selectedPeriod.name })
                : t('pages.enrollments.noEnrollments')
            }
            className="border-0 py-8"
            action={
              <Link
                href="/dashboard/enrollments?action=create"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                {t('quickActions.newEnrollment')}
              </Link>
            }
          />
        ) : (
          <DataTable
            data={recentEnrollments}
            columns={enrollmentColumns}
            getRowKey={(item) => item.id}
          />
        )}
      </Panel>
    </div>
  )
}
