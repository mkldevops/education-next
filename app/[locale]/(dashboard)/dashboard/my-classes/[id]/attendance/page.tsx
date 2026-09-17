import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { isAttendanceClosed } from '@/domain/attendance-closure'
import { attendanceUtcDate } from '@/domain/attendance-date'
import { attendanceScheduleWeekday } from '@/domain/attendance-weekday'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { requireSchoolSession, requireTeacher } from '../../../../_lib/auth-helper'
import { AttendancePanel } from './_components/attendance-panel'

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ date?: string; slotId?: string; occurrence?: string }>
}) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const query = await searchParams
  const context = await requireSchoolSession()
  const admin = context.isSuperAdmin || context.role === 'ADMIN'
  const teacher = admin ? null : await requireTeacher()
  const schoolId = context.schoolId
  const attendanceConfig = await db.config.findFirst({
    where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
    select: { value: true },
  })
  if (!readsAsOptedIn(attendanceConfig?.value)) notFound()
  const classPeriod = await db.classPeriod.findFirst({
    where: {
      id,
      schoolId,
      ...(teacher ? { teachers: { some: { teacherId: teacher.teacherId } } } : {}),
    },
    select: { id: true, name: true },
  })
  if (!classPeriod) notFound()
  const requestedDate = attendanceUtcDate(query.date)
  const date = requestedDate.toISOString().slice(0, 10)
  const occurredOn = new Date(`${date}T00:00:00.000Z`)
  const [scheduledSlots, closures] = await Promise.all([
    db.classScheduleSlot.findMany({
      where: {
        schoolId,
        classPeriodId: classPeriod.id,
        weekday: attendanceScheduleWeekday(occurredOn),
      },
      select: { id: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    }),
    db.event.findMany({
      where: {
        schoolId,
        isActive: true,
        status: 'PUBLISHED',
        category: 'CLOSURE',
        startAt: { lt: new Date(occurredOn.getTime() + 86400000) },
        OR: [{ endAt: null }, { endAt: { gte: occurredOn } }],
      },
      select: { status: true, category: true, startAt: true, endAt: true },
    }),
  ])
  const attendanceClosed = isAttendanceClosed(closures, occurredOn)
  const slots = attendanceClosed ? [] : scheduledSlots
  const selectedSlot = scheduledSlots.find((slot) => slot.id === query.slotId)
  const selectedOccurrence = query.occurrence === 'adhoc' ? 'adhoc' : undefined
  if ((query.slotId && !selectedSlot) || (query.slotId && selectedOccurrence)) notFound()
  const occurrenceKey = selectedSlot?.id ?? selectedOccurrence
  const initialSession = occurrenceKey
    ? await db.attendanceSession.findUnique({
        where: {
          schoolId_classPeriodId_occurredOn_occurrenceKey: {
            schoolId,
            classPeriodId: classPeriod.id,
            occurredOn,
            occurrenceKey,
          },
        },
        select: {
          id: true,
          status: true,
          entries: {
            select: { id: true, studentName: true, status: true, lateMinutes: true, message: true },
            orderBy: { studentName: 'asc' },
          },
        },
      })
    : null
  if (attendanceClosed && selectedSlot && !initialSession) notFound()
  const panelSlots = attendanceClosed && selectedSlot && initialSession ? [selectedSlot] : slots
  const t = await getTranslations('dashboard.pages.attendance')
  return (
    <AttendancePanel
      key={`${classPeriod.id}:${date}:${selectedSlot?.id ?? selectedOccurrence ?? 'select'}`}
      classPeriodId={classPeriod.id}
      className={classPeriod.name}
      occurredOn={date}
      locale={locale}
      slots={panelSlots}
      selectedSlotId={selectedSlot?.id}
      selectedOccurrence={selectedOccurrence}
      initialSession={initialSession}
      labels={{
        title: t('title'),
        start: t('start'),
        draft: t('draft'),
        validate: t('validate'),
        present: t('present'),
        late: t('late'),
        absent: t('absent'),
        unrecorded: t('unrecorded'),
        date: t('date'),
        changeDate: t('showOccurrences'),
        progress: t('progress', { recorded: '{recorded}', total: '{total}' }),
        markRemainingPresent: t('markRemainingPresent', { count: '{count}' }),
        reviewAttendance: t('reviewAttendance'),
        partialWarning: t('partialWarning', { count: '{count}' }),
        partialWarningSingle: t('partialWarningSingle'),
        validatePartial: t('validatePartial'),
        returnToEntry: t('returnToEntry'),
        correctAttendance: t('correctAttendance'),
        returnClasses: t('returnClasses'),
        validatedStatus: t('validatedStatus'),
        schedule: t('schedule'),
        selectOccurrence: t('selectOccurrence'),
        exceptional: t('exceptional'),
        startExceptional: t('startExceptional'),
        saving: t('saving'),
        saved: t('saved'),
        retry: t('retry'),
        lateMinutes: t('lateMinutes'),
        message: t('message'),
        messageHint: t('messageHint'),
        previousStudent: t('previousStudent'),
        nextStudent: t('nextStudent'),
        previous: t('previous'),
        next: t('next'),
        studentPosition: t('studentPosition', { current: '{current}', total: '{total}' }),
        saveBeforeContinue: t('saveBeforeContinue'),
        summary: t('summary'),
        reviewSubtitle: t('reviewSubtitle'),
        completeStudents: t('completeStudents', { count: '{count}' }),
        completeStudent: t('completeStudent'),
        all: t('all'),
        edit: t('edit'),
        noStudents: t('noStudents'),
        errors: {
          validationError: t('errors.validationError'),
          notFound: t('errors.notFound'),
          attendanceDisabled: t('errors.attendanceDisabled'),
          attendanceClosed: t('errors.attendanceClosed'),
          sessionCancelled: t('sessionCancelled'),
          unexpected: t('errors.unexpected'),
        },
      }}
    />
  )
}
