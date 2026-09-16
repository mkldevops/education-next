import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { isAttendanceClosed } from '@/domain/attendance-closure'
import { attendanceUtcDate } from '@/domain/attendance-date'
import { expectedAttendance } from '@/domain/attendance-tracking'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { getSelectedPeriod } from '@/features/dashboard/period'
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
  const t = await getTranslations('dashboard.pages.attendance')
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
  const slots = selectedPeriod
    ? await db.classScheduleSlot.findMany({
        where: {
          schoolId,
          classPeriod: {
            isActive: true,
            ...(selectedPeriod ? { periodId: selectedPeriod.id } : {}),
            ...(classId ? { id: classId } : {}),
            ...(actorTeacherId || filterTeacherId
              ? { teachers: { some: { teacherId: actorTeacherId ?? filterTeacherId } } }
              : {}),
          },
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
          occurredOn: new Date(
            Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
          ),
        },
        select: { id: true, classPeriodId: true, occurrenceKey: true, status: true },
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
  return (
    <main>
      <h1>{t('trackingTitle')}</h1>
      {admin && (
        <form method="get">
          <label>
            {t('date')}
            <input type="date" name="date" defaultValue={today.toISOString().slice(0, 10)} />
          </label>
          <label>
            {t('class')}
            <select name="classId" defaultValue={classId ?? ''}>
              <option value="">{t('allClasses')}</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('teacher')}
            <select name="teacherId" defaultValue={filterTeacherId ?? ''}>
              <option value="">{t('allTeachers')}</option>
              {teachers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.firstName} {item.lastName}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">{t('applyFilters')}</button>
        </form>
      )}
      {occurrences.length === 0 ? (
        <p>{t('empty')}</p>
      ) : (
        <ul>
          {occurrences.map((item) => {
            const session = sessions.find(
              (candidate) =>
                candidate.classPeriodId === item.classPeriodId &&
                candidate.occurrenceKey === item.classScheduleSlotId
            )
            return (
              <li key={item.classScheduleSlotId}>
                {slots.find((slot) => slot.id === item.classScheduleSlotId)?.classPeriod.name}:{' '}
                {t(
                  item.status === 'NOT_STARTED'
                    ? 'notStarted'
                    : item.status === 'IN_PROGRESS'
                      ? 'inProgress'
                      : 'validated'
                )}{' '}
                {admin &&
                  (session ? (
                    <CancelAttendanceForm sessionId={session.id} cancelled label={t('cancel')} />
                  ) : (
                    <CancelOccurrenceForm
                      classPeriodId={item.classPeriodId}
                      classScheduleSlotId={item.classScheduleSlotId}
                      occurredOn={item.occurredOn}
                      label={t('cancel')}
                    />
                  ))}
              </li>
            )
          })}
        </ul>
      )}
      {admin &&
        sessions
          .filter((session) => session.status === 'CANCELLED')
          .map((session) => (
            <CancelAttendanceForm
              key={session.id}
              sessionId={session.id}
              cancelled={false}
              label={t('restore')}
            />
          ))}
    </main>
  )
}
