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
  Landmark,
  Plus,
  SlidersHorizontal,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { totalPaidAmount } from '@/domain/payment'
import { schoolToday } from '@/domain/school-date'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { configGateway } from '@/gateways/config-gateway'
import { schoolGateway } from '@/gateways/school-gateway'
import { Link, redirect } from '@/i18n/routing'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { auth } from '@/lib/auth'
import { formatDate } from '@/lib/date'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/decimal'
import { UNPRICED_PLAN_NAME } from '@/lib/payment-config'
import { getSchoolContext, hasSchoolRole, isActiveSchoolAdmin } from '@/lib/school-context'
import { getSchoolRegionalSettings } from '@/lib/school-regional-settings'
import { cn } from '@/lib/utils'
import { isClassScheduleEnabled } from '@/use-cases/class-schedules/is-class-schedule-enabled'
import { isMealsEnabled } from '@/use-cases/config/is-meals-enabled'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { isEventsEnabled } from '@/use-cases/events/is-events-enabled'
import { isOnlinePaymentAvailable } from '@/use-cases/payments/stripe-settings'
import { requireSchoolScope } from '../_lib/auth-helper'
import { CollectionOverview } from './_components/collection-overview'
import { CustomizeHomeDialog } from './_components/customize-home-dialog'
import { Panel, PanelLink, StatStrip, TaskRow } from './_components/home-widgets'
import { SchoolInsightsSection } from './_components/school-insights'
import { UnlinkedParentNotice } from './_components/unlinked-parent-notice'
import { UpcomingEventsCard } from './_components/upcoming-events-card'
import { getDashboardOverview } from './_lib/dashboard-overview'
import { type HomeWidget, readHiddenWidgets } from './_lib/home-widgets'
import { getParentHome } from './_lib/parent-home'
import { getTodayAgenda } from './_lib/today-agenda'
import { loadMealDues } from './cashier/_lib/debtors-data'
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
  // Un enseignant qui est aussi parent d'une famille liée garde l'accueil parent.
  const homeless = context !== null && !isActiveSchoolAdmin(context) && !context.familyId
  if (homeless && hasSchoolRole(context, 'TEACHER')) {
    redirect({ href: '/dashboard/my-classes', locale })
  }
  // La caisse est l'accueil d'un caissier sans famille liée ; sa garde refuse une école sans repas.
  if (homeless && hasSchoolRole(context, 'CASHIER')) {
    redirect({ href: '/dashboard/cashier', locale })
  }
  // Refus avant toute lecture de données familiales : sans famille liée, rien à borner.
  if (homeless && hasSchoolRole(context, 'PARENT')) {
    const school = await schoolGateway.findActiveById(context.schoolId)
    return (
      <UnlinkedParentNotice userName={session?.user.name ?? null} schoolName={school?.name ?? ''} />
    )
  }

  const scope = await requireSchoolScope()
  const [
    paymentsEnabled,
    eventsEnabled,
    scheduleEnabled,
    attendanceEnabled,
    activeSchool,
    { currency, timeZone },
  ] = await Promise.all([
    isPaymentsEnabled(scope.schoolId),
    isEventsEnabled(scope.schoolId),
    isClassScheduleEnabled(scope.schoolId),
    isAttendanceEnabled(scope.schoolId),
    schoolGateway.findActiveById(scope.schoolId),
    getSchoolRegionalSettings(scope.schoolId),
  ])
  const schoolName = activeSchool?.name ?? ''
  const userName = session?.user.name?.trim()
  const greeting = userName ? t('greeting', { name: userName }) : t('greetingNoName')
  const today = capitalize(
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone,
    }).format(new Date())
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  {formatCurrency(home.remainingBalance, locale, currency)}
                </p>
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {t('stats.scopeAll')}
                </p>
                <div className="mt-4">
                  <OnlinePaymentButton
                    amount={home.remainingBalance}
                    configured={onlinePaymentAvailable}
                    locale={locale}
                    currency={currency}
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

  const [overview, mealsEnabled, preferences] = await Promise.all([
    getDashboardOverview(scope.schoolId, paymentsEnabled),
    isMealsEnabled(scope.schoolId),
    db.user.findUnique({
      where: { id: scope.userId },
      select: { dashboardHiddenWidgets: true },
    }),
  ])
  const hidden = readHiddenWidgets(preferences?.dashboardHiddenWidgets ?? [])
  const shows = (widget: HomeWidget) => !hidden.has(widget)
  const {
    selectedPeriod,
    familyCount,
    studentCount,
    enrollmentCount,
    pendingEnrollmentCount,
    insights,
  } = overview
  const [agenda, mealDues] = await Promise.all([
    getTodayAgenda(scope.schoolId, {
      periodId: selectedPeriod?.id ?? null,
      attendanceEnabled,
      scheduleEnabled,
    }),
    mealsEnabled ? loadMealDues(scope.schoolId, schoolToday(timeZone)) : null,
  ])
  const totals = insights.payments?.totals ?? null

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
            amount: formatCurrency(totals.uncashedAmount, locale, currency),
          }),
        }
      : null,
    mealDues && mealDues.toRemind > 0
      ? {
          key: 'meals',
          href: '/dashboard/cashier/debtors',
          icon: UtensilsCrossed,
          tone: 'danger' as const,
          title: t('home.todo.meals', { count: mealDues.toRemind }),
          hint: t('home.todo.mealsHint'),
        }
      : null,
  ].filter((task) => task !== null)

  const hasCollection = !!(insights.payments || mealDues)
  const available: HomeWidget[] = [
    ...(hasCollection ? (['collection'] as const) : []),
    'tasks',
    'headcount',
    ...(insights.payments ? (['collectionChart'] as const) : []),
    'classFill',
    ...(agenda ? (['schedule'] as const) : []),
    ...(eventsCard ? (['events'] as const) : []),
  ]
  const showSchedule = !!agenda && shows('schedule')
  const showEvents = !!eventsCard && shows('events')
  const sideColumn = showSchedule || showEvents
  const mainWidgets: HomeWidget[] = ['tasks', 'headcount', 'collectionChart', 'classFill']
  const mainColumn = mainWidgets.some((widget) => available.includes(widget) && shows(widget))
  const nothingShown = available.every((widget) => !shows(widget))

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={greeting}
        description={subtitle}
        actions={
          <>
            <CustomizeHomeDialog
              available={available}
              hidden={available.filter((widget) => !shows(widget))}
            />
            <Link
              href="/dashboard/enrollments?action=create"
              className={buttonVariants({ variant: 'outline' })}
            >
              {t('quickActions.newEnrollment')}
            </Link>
            <Link href="/dashboard/families?action=create" className={buttonVariants()}>
              <Plus size={16} aria-hidden="true" />
              {t('quickActions.newFamily')}
            </Link>
          </>
        }
      />

      {nothingShown && (
        <EmptyState
          icon={SlidersHorizontal}
          title={t('home.customize.allHidden')}
          description={t('home.customize.allHiddenHint')}
        />
      )}

      {hasCollection && shows('collection') && (
        <CollectionOverview
          payments={insights.payments}
          meals={mealDues}
          locale={locale}
          currency={currency}
        />
      )}

      <div
        className={
          sideColumn && mainColumn
            ? 'grid grid-cols-1 gap-6 lg:grid-cols-5'
            : 'grid grid-cols-1 gap-6'
        }
      >
        {mainColumn && (
          <div className={cn('space-y-6', sideColumn && 'lg:col-span-3')}>
            {shows('tasks') && (
              <Panel
                id="todo-heading"
                title={t('home.todo.title')}
                className="home-rise"
                action={
                  tasks.length > 0 ? (
                    <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-semibold text-danger tabular-nums">
                      {tasks.length}
                    </span>
                  ) : undefined
                }
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
            )}
            {shows('headcount') && (
              <StatStrip
                label={t('home.headcount.label')}
                items={[
                  {
                    key: 'students',
                    href: '/dashboard/students',
                    label: t('stats.students'),
                    value: studentCount,
                  },
                  {
                    key: 'families',
                    href: '/dashboard/families',
                    label: t('stats.families'),
                    value: familyCount,
                  },
                  {
                    key: 'enrollments',
                    href: '/dashboard/enrollments',
                    label: t('stats.enrollments'),
                    value: enrollmentCount,
                  },
                ]}
              />
            )}
            {(shows('collectionChart') || shows('classFill')) && (
              <SchoolInsightsSection
                insights={insights}
                locale={locale}
                currency={currency}
                showChart={shows('collectionChart')}
                showClasses={shows('classFill')}
              />
            )}
          </div>
        )}

        {sideColumn && (
          <div className={cn('space-y-6', mainColumn && 'lg:col-span-2')}>
            {showSchedule && agenda && (
              <Panel
                id="today-classes-heading"
                title={t('home.schedule.title')}
                className="home-rise"
                action={
                  <PanelLink
                    href={attendanceEnabled ? '/dashboard/attendance' : '/dashboard/planning'}
                  >
                    {attendanceEnabled
                      ? t('home.schedule.openAttendance')
                      : t('home.schedule.viewAll')}
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
                  <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-4 before:w-px before:bg-border">
                    {agenda.classes.map((item) => (
                      <li key={item.slotId} className="relative flex items-start gap-3 px-1 py-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'relative mt-1.5 ml-2 size-2.5 shrink-0 rounded-full ring-4 ring-surface',
                            item.attendance === 'VALIDATED'
                              ? 'bg-success'
                              : item.attendance === 'IN_PROGRESS'
                                ? 'bg-warning'
                                : 'bg-border'
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-muted-foreground tabular-nums">
                            {item.startTime}–{item.endTime}
                          </span>
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
                            className="mt-1 shrink-0"
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
            )}
            {showEvents && eventsCard}
          </div>
        )}
      </div>
    </div>
  )
}
