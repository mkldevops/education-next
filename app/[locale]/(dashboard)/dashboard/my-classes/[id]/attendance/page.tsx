import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { attendanceUtcDate } from '@/domain/attendance-date'
import { planningWeekday } from '@/domain/current-week-dates'
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
  searchParams: Promise<{ date?: string; slotId?: string }>
}) {
  await connection()
  const { locale, id } = await params
  setRequestLocale(locale)
  const query = await searchParams
  const context = await requireSchoolSession()
  const admin = context.isSuperAdmin || context.role === 'ADMIN'
  let teacherId: string | undefined
  if (!admin) ({ teacherId } = await requireTeacher())
  const { schoolId } = context
  const occurredOn = attendanceUtcDate(query.date).toISOString().slice(0, 10)
  const classScheduleSlotId =
    query.slotId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(query.slotId)
      ? query.slotId
      : undefined
  if (!classScheduleSlotId) notFound()
  const attendanceConfig = await db.config.findFirst({
    where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
    select: { value: true },
  })
  if (!readsAsOptedIn(attendanceConfig?.value)) notFound()
  const classPeriod = await db.classPeriod.findFirst({
    where: {
      id,
      schoolId,
      ...(admin ? {} : { teachers: { some: { teacherId } } }),
      scheduleSlots: {
        some: {
          id: classScheduleSlotId,
          weekday: planningWeekday(new Date(`${occurredOn}T00:00:00.000Z`)),
        },
      },
    },
    select: { id: true, name: true },
  })
  if (!classPeriod) notFound()
  const initialSession = await db.attendanceSession.findUnique({
    where: {
      schoolId_classPeriodId_occurredOn_occurrenceKey: {
        schoolId,
        classPeriodId: classPeriod.id,
        occurredOn: new Date(`${occurredOn}T00:00:00.000Z`),
        occurrenceKey: classScheduleSlotId,
      },
    },
    include: { entries: { orderBy: { studentName: 'asc' } } },
  })
  if (initialSession?.status === 'CANCELLED') notFound()
  const t = await getTranslations('dashboard.pages.attendance')
  return (
    <AttendancePanel
      classPeriodId={classPeriod.id}
      className={classPeriod.name}
      occurredOn={occurredOn}
      classScheduleSlotId={classScheduleSlotId}
      initialSession={initialSession ?? undefined}
      labels={{
        title: t('title'),
        start: t('start'),
        allPresent: t('allPresent'),
        draft: t('draft'),
        validate: t('validate'),
        validated: t('validated'),
        saveCorrections: t('saveCorrections'),
        validationSuccess: t('validationSuccess'),
        correctionsSaved: t('correctionsSaved'),
        savedTitle: t('savedTitle'),
        returningToTracking: t('returningToTracking'),
        present: t('present'),
        late: t('late'),
        absent: t('absent'),
        unrecorded: t('unrecorded'),
      }}
    />
  )
}
