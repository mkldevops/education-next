import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { expectedAttendance } from '@/domain/attendance-tracking'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { getSchoolContext } from '@/lib/school-context'
import { requireTeacher } from '../../_lib/auth-helper'
import { CancelAttendanceForm, CancelOccurrenceForm } from './_components/cancel-attendance-form'

export default async function AttendanceTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ date?: string; classId?: string }>
}) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.attendance')
  const query = await searchParams
  let schoolId: string
  let teacherId: string | undefined
  const context = await getSchoolContext()
  if (!context) return null
  if (context.isSuperAdmin || context.role === 'ADMIN') schoolId = context.schoolId
  else {
    const teacher = await requireTeacher()
    schoolId = teacher.schoolId
    teacherId = teacher.teacherId
  }
  const config = await db.config.findFirst({
    where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
    select: { value: true },
  })
  if (!readsAsOptedIn(config?.value)) notFound()
  const selectedPeriod = await getSelectedPeriod(schoolId)
  const today = query.date ? new Date(`${query.date}T00:00:00.000Z`) : new Date()
  const slots = await db.classScheduleSlot.findMany({
    where: {
      schoolId,
      classPeriod: {
        isActive: true,
        ...(selectedPeriod ? { periodId: selectedPeriod.id } : {}),
        ...(query.classId ? { id: query.classId } : {}),
        ...(teacherId ? { teachers: { some: { teacherId } } } : {}),
      },
    },
    select: {
      id: true,
      classPeriodId: true,
      weekday: true,
      classPeriod: { select: { name: true } },
    },
  })
  const sessions = await db.attendanceSession.findMany({
    where: {
      schoolId,
      occurredOn: new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
      ),
    },
    select: { id: true, classPeriodId: true, occurrenceKey: true, status: true },
  })
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const closure = await db.event.findFirst({
    where: {
      schoolId,
      isActive: true,
      status: 'PUBLISHED',
      category: 'CLOSURE',
      startAt: { lte: new Date(day.getTime() + 86400000) },
      OR: [{ endAt: null }, { endAt: { gte: day } }],
    },
    select: { id: true },
  })
  const occurrences = closure ? [] : expectedAttendance(today, slots, sessions)
  const admin = context.isSuperAdmin || context.role === 'ADMIN'
  return (
    <main>
      <h1>{t('trackingTitle')}</h1>
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
