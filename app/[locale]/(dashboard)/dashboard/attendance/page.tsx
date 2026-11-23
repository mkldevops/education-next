import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { attendanceUtcDate } from '@/domain/attendance-date'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { getSchoolContext, hasSchoolRole, isActiveSchoolAdmin } from '@/lib/school-context'
import { getAttendanceFrequency } from '@/use-cases/config/get-attendance-frequency'
import { requireSchoolSession, requireTeacher } from '../../_lib/auth-helper'
import { AttendancePeriodView } from './_components/attendance-period-view'

type SearchParams = {
  date?: string
  classId?: string
  range?: string
  from?: string
  to?: string
  all?: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function uuidOrUndefined(value: string | undefined) {
  return value && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) ? value : undefined
}

/**
 * Les anciens liens de la vue Jour (`?date=`) ouvrent les deux semaines qui finissent ce jour-là.
 */
function periodQuery(query: SearchParams) {
  if (query.range || !query.date || !DATE_PATTERN.test(query.date)) return query
  const day = attendanceUtcDate(query.date)
  const from = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - 14))
  return { ...query, range: 'custom', from: from.toISOString().slice(0, 10), to: query.date }
}

/**
 * Même porte que la page : administrateur actif ou enseignant de l'école. Les helpers
 * de `page-metadata` ne couvrent pas le rôle enseignant ; un autre rôle reçoit le titre 404.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const [t, context] = await Promise.all([getTranslations({ locale }), getSchoolContext()])
  const allowed =
    context !== null && (isActiveSchoolAdmin(context) || hasSchoolRole(context, 'TEACHER'))
  return {
    title: allowed ? t('dashboard.pages.attendance.trackingTitle') : t('errorPages.404.title'),
  }
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
  const query = periodQuery(await searchParams)
  const context = await requireSchoolSession()
  const admin = isActiveSchoolAdmin(context)
  const teacher = admin ? null : await requireTeacher()
  const schoolId = context.schoolId
  const config = await db.config.findFirst({
    where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
    select: { value: true },
  })
  if (!readsAsOptedIn(config?.value)) notFound()

  const [frequency, period] = await Promise.all([
    getAttendanceFrequency(schoolId),
    getSelectedPeriod(schoolId),
  ])
  return AttendancePeriodView({
    locale,
    schoolId,
    teacherId: teacher?.teacherId ?? null,
    admin,
    frequency,
    period,
    query: {
      range: query.range,
      from: query.from,
      to: query.to,
      classId: uuidOrUndefined(query.classId),
      all: query.all === '1',
    },
  })
}
