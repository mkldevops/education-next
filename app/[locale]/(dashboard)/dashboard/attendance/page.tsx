import { Breadcrumbs, buttonVariants, Card, EmptyState, StatusBadge } from '@peaklab/ui'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { isAttendanceClosed } from '@/domain/attendance-closure'
import { attendanceUtcDate } from '@/domain/attendance-date'
import { expectedAttendance } from '@/domain/attendance-tracking'
import { attendanceClassPeriodScope } from '@/domain/attendance-tracking-scope'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { Link } from '@/i18n/routing'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { requireSchoolSession, requireTeacher } from '../../_lib/auth-helper'
import { CancelAttendanceForm, CancelOccurrenceForm } from './_components/cancel-attendance-form'

type SearchParams = { date?: string; classId?: string; teacherId?: string }

function dateParam(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shiftUtcDate(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
}

function isUuid(value: string | undefined) {
  return value && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) ? value : undefined
}

function attendanceHref(date: Date, filters: Pick<SearchParams, 'classId' | 'teacherId'>) {
  const params = new URLSearchParams({ date: dateParam(date) })
  if (filters.classId) params.set('classId', filters.classId)
  if (filters.teacherId) params.set('teacherId', filters.teacherId)
  return `/dashboard/attendance?${params.toString()}`
}

function attendanceEntryHref(classPeriodId: string, date: Date, slotId?: string) {
  const params = new URLSearchParams({ date: dateParam(date) })
  if (slotId) params.set('slotId', slotId)
  else params.set('occurrence', 'adhoc')
  return `/dashboard/my-classes/${classPeriodId}/attendance?${params.toString()}`
}

export default async function AttendanceTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const formattedDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format
  const [t, tBreadcrumbs] = await Promise.all([
    getTranslations('dashboard.pages.attendance'),
    getTranslations('dashboard.breadcrumbs'),
  ])
  const query = await searchParams
  const context = await requireSchoolSession()
  const admin = context.isSuperAdmin || context.role === 'ADMIN'
  const teacher = admin ? null : await requireTeacher()
  const schoolId = context.schoolId
  const config = await db.config.findFirst({
    where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
    select: { value: true },
  })
  if (!readsAsOptedIn(config?.value)) notFound()

  const selectedPeriod = await getSelectedPeriod(schoolId)
  const today = attendanceUtcDate(query.date)
  const classId = teacher ? undefined : isUuid(query.classId)
  const filterTeacherId = teacher ? undefined : isUuid(query.teacherId)
  const classPeriodScope = attendanceClassPeriodScope({
    periodId: selectedPeriod?.id,
    classId,
    teacherId: teacher?.teacherId ?? filterTeacherId,
  })
  const queryClassPeriodScope = classPeriodScope ?? { isActive: true, periodId: '' }
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const [slots, sessions, closures, classes, teachers] = selectedPeriod
    ? await Promise.all([
        db.classScheduleSlot.findMany({
          where: { schoolId, classPeriod: queryClassPeriodScope },
          select: {
            id: true,
            classPeriodId: true,
            weekday: true,
            startTime: true,
            endTime: true,
            classPeriod: { select: { name: true } },
          },
          orderBy: [{ classPeriod: { name: 'asc' } }, { startTime: 'asc' }],
        }),
        db.attendanceSession.findMany({
          where: { schoolId, classPeriod: queryClassPeriodScope, occurredOn: day },
          select: {
            id: true,
            classPeriodId: true,
            classScheduleSlotId: true,
            occurrenceKey: true,
            status: true,
            classPeriod: { select: { name: true } },
          },
        }),
        db.event.findMany({
          where: {
            schoolId,
            isActive: true,
            status: 'PUBLISHED',
            category: 'CLOSURE',
            startAt: { lt: new Date(day.getTime() + 86400000) },
            OR: [{ endAt: null }, { endAt: { gte: day } }],
          },
          select: { status: true, category: true, startAt: true, endAt: true },
        }),
        admin
          ? db.classPeriod.findMany({
              where: { schoolId, periodId: selectedPeriod.id, isActive: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          : Promise.resolve([]),
        admin
          ? db.teacher.findMany({
              where: {
                schoolId,
                isActive: true,
                classPeriods: {
                  some: { classPeriod: { periodId: selectedPeriod.id, isActive: true } },
                },
              },
              select: { id: true, firstName: true, lastName: true },
              orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            })
          : Promise.resolve([]),
      ])
    : [[], [], [], [], []]
  const closed = isAttendanceClosed(closures, day)
  const occurrences = expectedAttendance(
    today,
    closed
      ? slots.filter((slot) =>
          sessions.some(
            (session) =>
              session.classPeriodId === slot.classPeriodId && session.occurrenceKey === slot.id
          )
        )
      : slots,
    sessions
  )
  const scheduledSessions = sessions.filter((session) => session.occurrenceKey !== 'adhoc')
  const adhocSessions = sessions.filter((session) => session.occurrenceKey === 'adhoc')
  const cancelledSessions = scheduledSessions.filter(
    (session) =>
      session.status === 'CANCELLED' &&
      session.classScheduleSlotId &&
      slots.some((slot) => slot.id === session.classScheduleSlotId)
  )
  const filtersActive = Boolean(classId || filterTeacherId)
  const filters = { classId, teacherId: filterTeacherId }
  const errorLabels = {
    validationError: t('errors.validationError'),
    notFound: t('errors.notFound'),
    attendanceDisabled: t('errors.attendanceDisabled'),
    sessionCancelled: t('errors.sessionCancelled'),
    unexpected: t('errors.unexpected'),
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('attendance') },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite">{t('trackingTitle')}</h1>
          <p className="mt-1 text-sm text-graphite-600">{formattedDate(today)}</p>
          <p className="mt-1 text-sm text-graphite-600">
            {t('description')}
            {selectedPeriod ? ` · ${selectedPeriod.name}` : ''}
          </p>
        </div>
        <nav
          aria-label={t('date')}
          className="flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:justify-end"
        >
          <Link
            href={attendanceHref(shiftUtcDate(today, -1), filters)}
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'min-h-11' })}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {t('previousDay')}
          </Link>
          <Link
            href={attendanceHref(new Date(), filters)}
            className={buttonVariants({ size: 'sm', className: 'min-h-11' })}
          >
            {t('today')}
          </Link>
          <Link
            href={attendanceHref(shiftUtcDate(today, 1), filters)}
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'min-h-11' })}
          >
            {t('nextDay')}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </nav>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-2xl font-semibold text-graphite">{occurrences.length}</p>
          <p className="text-sm text-graphite-600">
            {t('expectedCalls', { count: occurrences.length })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-semibold text-graphite">{cancelledSessions.length}</p>
          <p className="text-sm text-graphite-600">
            {t('cancelledCalls', { count: cancelledSessions.length })}
          </p>
        </Card>
      </div>

      {admin && (
        <Card className="p-4">
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <label className="grid gap-1 text-sm font-medium text-graphite">
              {t('date')}
              <input
                className="h-10 rounded border border-alabaster-600 bg-white px-3 text-sm"
                type="date"
                name="date"
                defaultValue={dateParam(today)}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-graphite">
              {t('class')}
              <select
                className="h-10 rounded border border-alabaster-600 bg-white px-3 text-sm"
                name="classId"
                defaultValue={classId ?? ''}
              >
                <option value="">{t('allClasses')}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-graphite">
              {t('teacher')}
              <select
                className="h-10 rounded border border-alabaster-600 bg-white px-3 text-sm"
                name="teacherId"
                defaultValue={filterTeacherId ?? ''}
              >
                <option value="">{t('allTeachers')}</option>
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={buttonVariants({ className: 'min-h-11' })}>
                {t('applyFilters')}
              </button>
              {filtersActive && (
                <Link
                  href={attendanceHref(today, {})}
                  className={buttonVariants({ variant: 'outline', className: 'min-h-11' })}
                >
                  {t('resetFilters')}
                </Link>
              )}
            </div>
          </form>
        </Card>
      )}

      {occurrences.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={filtersActive ? t('noMatchingFilters') : t('noScheduledForDay')}
          description={filtersActive ? undefined : t('empty')}
          action={
            filtersActive ? (
              <Link
                href={attendanceHref(today, {})}
                className={buttonVariants({ variant: 'outline', className: 'min-h-11' })}
              >
                {t('resetFilters')}
              </Link>
            ) : admin ? (
              <Link
                href="/dashboard/planning"
                className={buttonVariants({ variant: 'outline', className: 'min-h-11' })}
              >
                {t('viewSchedule')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section aria-labelledby="scheduled-occurrences-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="scheduled-occurrences-heading" className="text-lg font-semibold text-graphite">
              {t('scheduledOccurrences')}
            </h2>
            <span className="text-sm text-graphite-600">{occurrences.length}</span>
          </div>
          <div className="grid gap-3">
            {occurrences.map((item) => {
              const slot = slots.find((candidate) => candidate.id === item.classScheduleSlotId)
              const session = scheduledSessions.find(
                (candidate) =>
                  candidate.classPeriodId === item.classPeriodId &&
                  candidate.occurrenceKey === item.classScheduleSlotId
              )
              const statusKey =
                item.status === 'NOT_STARTED'
                  ? 'notStarted'
                  : item.status === 'IN_PROGRESS'
                    ? 'inProgress'
                    : 'validated'
              const actionLabel =
                item.status === 'NOT_STARTED'
                  ? t('start')
                  : item.status === 'IN_PROGRESS'
                    ? t('resume')
                    : t('viewOrCorrect')
              return (
                <Card
                  key={item.classScheduleSlotId}
                  className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="w-full min-w-0 sm:flex-1">
                    <h3 className="font-semibold text-graphite">{slot?.classPeriod.name}</h3>
                    <p className="mt-1 text-sm text-graphite-600">
                      {formattedDate(today)} · {slot?.startTime}–{slot?.endTime}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      item.status === 'VALIDATED'
                        ? 'green'
                        : item.status === 'IN_PROGRESS'
                          ? 'amber'
                          : 'gray'
                    }
                    label={t(statusKey)}
                  />
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <Link
                      href={attendanceEntryHref(
                        item.classPeriodId,
                        today,
                        item.classScheduleSlotId
                      )}
                      className={buttonVariants({ size: 'sm', className: 'min-h-11' })}
                    >
                      {actionLabel}
                    </Link>
                    {admin &&
                      (session ? (
                        <CancelAttendanceForm
                          sessionId={session.id}
                          cancelled
                          label={t('cancel')}
                          pendingLabel={t('cancellationPending')}
                          errors={errorLabels}
                        />
                      ) : (
                        <CancelOccurrenceForm
                          classPeriodId={item.classPeriodId}
                          classScheduleSlotId={item.classScheduleSlotId}
                          occurredOn={item.occurredOn}
                          label={t('cancel')}
                          pendingLabel={t('cancellationPending')}
                          errors={errorLabels}
                        />
                      ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {adhocSessions.length > 0 && (
        <section aria-labelledby="adhoc-occurrences-heading" className="space-y-3">
          <h2 id="adhoc-occurrences-heading" className="text-lg font-semibold text-graphite">
            {t('adhocOccurrences')}
          </h2>
          <div className="grid gap-3">
            {adhocSessions.map((session) => (
              <Card
                key={session.id}
                className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="w-full min-w-0 sm:flex-1">
                  <h3 className="font-semibold text-graphite">{session.classPeriod.name}</h3>
                  <p className="mt-1 text-sm text-graphite-600">
                    {t('exceptionalOccurrence')} · {formattedDate(today)}
                  </p>
                </div>
                <StatusBadge
                  status={
                    session.status === 'VALIDATED'
                      ? 'green'
                      : session.status === 'CANCELLED'
                        ? 'red'
                        : 'amber'
                  }
                  label={
                    session.status === 'VALIDATED'
                      ? t('validated')
                      : session.status === 'CANCELLED'
                        ? t('sessionCancelled')
                        : t('inProgress')
                  }
                />
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  {session.status !== 'CANCELLED' && (
                    <Link
                      href={attendanceEntryHref(session.classPeriodId, today)}
                      className={buttonVariants({ size: 'sm', className: 'min-h-11' })}
                    >
                      {session.status === 'VALIDATED' ? t('viewOrCorrect') : t('resume')}
                    </Link>
                  )}
                  {admin && (
                    <CancelAttendanceForm
                      sessionId={session.id}
                      cancelled={session.status !== 'CANCELLED'}
                      label={session.status === 'CANCELLED' ? t('restore') : t('cancel')}
                      pendingLabel={
                        session.status === 'CANCELLED'
                          ? t('restorePending')
                          : t('cancellationPending')
                      }
                      errors={errorLabels}
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {admin &&
        cancelledSessions.map((session) => {
          const slot = slots.find((candidate) => candidate.id === session.classScheduleSlotId)
          return (
            <Card
              key={session.id}
              className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="w-full min-w-0 sm:flex-1">
                <h2 className="font-semibold text-graphite">{session.classPeriod.name}</h2>
                <p className="mt-1 text-sm text-graphite-600">
                  {formattedDate(today)} · {slot?.startTime}–{slot?.endTime}
                </p>
              </div>
              <StatusBadge status="red" label={t('sessionCancelled')} />
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <CancelAttendanceForm
                  sessionId={session.id}
                  cancelled={false}
                  label={t('restore')}
                  pendingLabel={t('restorePending')}
                  errors={errorLabels}
                />
              </div>
            </Card>
          )
        })}
    </div>
  )
}
