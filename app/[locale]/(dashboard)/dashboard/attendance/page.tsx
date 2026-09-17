import {
  Breadcrumbs,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  StatusBadge,
} from '@peaklab/ui'
import { CalendarCheck2, CalendarX2, ClipboardCheck } from 'lucide-react'
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

export default async function AttendanceTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ date?: string; classId?: string; teacherId?: string }>
}) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const [t, tBreadcrumbs] = await Promise.all([
    getTranslations('dashboard.pages.attendance'),
    getTranslations('dashboard.breadcrumbs'),
  ])
  const query = await searchParams
  let schoolId: string
  let actorTeacherId: string | undefined
  const context = await requireSchoolSession()
  if (context.isSuperAdmin || context.role === 'ADMIN') schoolId = context.schoolId
  else {
    const teacher = await requireTeacher()
    schoolId = teacher.schoolId
    actorTeacherId = teacher.teacherId
  }
  const config = await db.config.findFirst({
    where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
    select: { value: true },
  })
  if (!readsAsOptedIn(config?.value)) notFound()
  const selectedPeriod = await getSelectedPeriod(schoolId)
  const today = attendanceUtcDate(query.date)
  const isUuid = (value: string | undefined) =>
    value && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) ? value : undefined
  const classId = actorTeacherId ? undefined : isUuid(query.classId)
  const filterTeacherId = actorTeacherId ? undefined : isUuid(query.teacherId)
  const classPeriodScope = attendanceClassPeriodScope({
    periodId: selectedPeriod?.id,
    classId,
    teacherId: actorTeacherId ?? filterTeacherId,
  })
  const queryClassPeriodScope = classPeriodScope ?? { isActive: true, periodId: '' }
  const slots = selectedPeriod
    ? await db.classScheduleSlot.findMany({
        where: {
          schoolId,
          classPeriod: queryClassPeriodScope,
        },
        select: {
          id: true,
          classPeriodId: true,
          weekday: true,
          classPeriod: { select: { name: true } },
        },
      })
    : []
  const sessions = selectedPeriod
    ? await db.attendanceSession.findMany({
        where: {
          schoolId,
          classPeriod: queryClassPeriodScope,
          occurredOn: new Date(
            Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
          ),
        },
        select: {
          id: true,
          classPeriodId: true,
          classScheduleSlotId: true,
          occurrenceKey: true,
          status: true,
          classPeriod: { select: { name: true } },
        },
      })
    : []
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const closures = selectedPeriod
    ? await db.event.findMany({
        where: {
          schoolId,
          isActive: true,
          status: 'PUBLISHED',
          category: 'CLOSURE',
          startAt: { lt: new Date(day.getTime() + 86400000) },
          OR: [{ endAt: null }, { endAt: { gte: day } }],
        },
        select: { status: true, category: true, startAt: true, endAt: true },
      })
    : []
  const occurrences = isAttendanceClosed(closures, day)
    ? []
    : expectedAttendance(today, slots, sessions)
  const admin = context.isSuperAdmin || context.role === 'ADMIN'
  const classes =
    admin && selectedPeriod
      ? await db.classPeriod.findMany({
          where: { schoolId, periodId: selectedPeriod.id, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : []
  const teachers =
    admin && selectedPeriod
      ? await db.teacher.findMany({
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
      : []
  const cancelledSessions = sessions.filter(
    (session) =>
      session.status === 'CANCELLED' &&
      session.classScheduleSlotId &&
      slots.some((slot) => slot.id === session.classScheduleSlotId)
  )
  const formattedDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(today)
  const statusBadge = {
    NOT_STARTED: 'gray',
    IN_PROGRESS: 'amber',
    VALIDATED: 'green',
  } as const

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: tBreadcrumbs('attendance') },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-graphite">{t('trackingTitle')}</h1>
          <p className="max-w-2xl text-sm text-graphite-600">
            {t('description')}
            {selectedPeriod ? ` · ${selectedPeriod.name}` : ''}
          </p>
        </div>
        <p className="text-sm font-medium capitalize text-graphite">{formattedDate}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-primary-light p-3 text-primary">
              <CalendarCheck2 aria-hidden="true" size={20} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-2xl font-bold text-graphite">{occurrences.length}</p>
              <p className="text-sm text-graphite-600">
                {t('expectedCalls', { count: occurrences.length })}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-alabaster-800 p-3 text-graphite-700">
              <CalendarX2 aria-hidden="true" size={20} />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-2xl font-bold text-graphite">{cancelledSessions.length}</p>
              <p className="text-sm text-graphite-600">
                {t('cancelledCalls', { count: cancelledSessions.length })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {admin && (
        <Card>
          <CardHeader className="p-4 pb-0">
            <CardTitle className="text-base">{t('filters')}</CardTitle>
            <CardDescription>{t('filtersDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form
              method="get"
              className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="attendance-date">{t('date')}</Label>
                <Input
                  id="attendance-date"
                  type="date"
                  name="date"
                  defaultValue={today.toISOString().slice(0, 10)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="attendance-class">{t('class')}</Label>
                <Select id="attendance-class" name="classId" defaultValue={classId ?? ''}>
                  <option value="">{t('allClasses')}</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="attendance-teacher">{t('teacher')}</Label>
                <Select
                  id="attendance-teacher"
                  name="teacherId"
                  defaultValue={filterTeacherId ?? ''}
                >
                  <option value="">{t('allTeachers')}</option>
                  {teachers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.firstName} {item.lastName}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" className="w-full xl:w-auto">
                {t('applyFilters')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {occurrences.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={t('empty')} description={t('emptyDescription')} />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-alabaster-700 bg-alabaster-900 p-4">
            <CardTitle className="text-base">
              {t('expectedCalls', { count: occurrences.length })}
            </CardTitle>
            <CardDescription>{t('callsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-alabaster-700">
              {occurrences.map((item) => {
                const session = sessions.find(
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
                const actionKey =
                  item.status === 'NOT_STARTED'
                    ? 'takeAttendance'
                    : item.status === 'IN_PROGRESS'
                      ? 'resumeAttendance'
                      : 'reviewAttendance'
                const attendanceHref = `/dashboard/my-classes/${item.classPeriodId}/attendance?date=${today.toISOString().slice(0, 10)}&slotId=${item.classScheduleSlotId}`
                return (
                  <li
                    key={item.classScheduleSlotId}
                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-alabaster-800 font-semibold text-graphite">
                        {slots
                          .find((slot) => slot.id === item.classScheduleSlotId)
                          ?.classPeriod.name.slice(0, 2)}
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="truncate font-semibold text-graphite">
                          {
                            slots.find((slot) => slot.id === item.classScheduleSlotId)?.classPeriod
                              .name
                          }
                        </p>
                        <StatusBadge status={statusBadge[item.status]} label={t(statusKey)} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link
                        href={attendanceHref}
                        className={buttonVariants({
                          variant: item.status === 'NOT_STARTED' ? 'default' : 'outline',
                        })}
                      >
                        {t(actionKey)}
                      </Link>
                      {admin &&
                        (session ? (
                          <CancelAttendanceForm
                            sessionId={session.id}
                            cancelled
                            label={t('cancel')}
                          />
                        ) : (
                          <CancelOccurrenceForm
                            classPeriodId={item.classPeriodId}
                            classScheduleSlotId={item.classScheduleSlotId}
                            occurredOn={item.occurredOn}
                            label={t('cancel')}
                          />
                        ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {admin && cancelledSessions.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-alabaster-700 p-4">
            <CardTitle className="text-base">
              {t('cancelledCalls', { count: cancelledSessions.length })}
            </CardTitle>
            <CardDescription>{t('cancelledDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-alabaster-700">
              {cancelledSessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-alabaster-800">
                      <CalendarX2 aria-hidden="true" size={18} className="text-graphite-700" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-graphite">{session.classPeriod.name}</p>
                      <StatusBadge status="red" label={t('cancelled')} />
                    </div>
                  </div>
                  <CancelAttendanceForm
                    sessionId={session.id}
                    cancelled={false}
                    label={t('restore')}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
