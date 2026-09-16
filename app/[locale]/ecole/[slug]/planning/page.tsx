import { EmptyState } from '@peaklab/ui'
import { CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { schoolGateway } from '@/gateways/school-gateway'
import { db } from '@/lib/db'
import { listPublicClassSchedule } from '@/use-cases/class-schedules/list-public-class-schedule'
import { ScheduleGrid } from '../../../(dashboard)/dashboard/planning/_components/schedule-grid'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

async function resolvePublicSchedule(slug: string) {
  const school = await schoolGateway.findBySlug(slug)
  if (!school?.isActive) return null

  const periods = await db.period.findMany({
    where: { schoolId: school.id, isActive: true },
    select: { id: true, name: true, startAt: true, endAt: true },
    orderBy: { startAt: 'desc' },
  })
  const now = new Date()
  const period =
    periods.find((candidate) => candidate.startAt <= now && now <= candidate.endAt) ?? periods[0]
  if (!period) return null

  const schedule = await listPublicClassSchedule(slug, period.id)
  if (schedule === 'notFound') return null
  return { school: schedule.school, period, slots: schedule.slots }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const result = await resolvePublicSchedule(slug)
  const t = await getTranslations({ locale, namespace: 'publicSchedule' })
  return result
    ? { title: t('metadata.title', { schoolName: result.school.name }) }
    : { title: t('notFoundTitle') }
}

export default async function PublicSchedulePage({ params }: Props) {
  await connection()
  const { locale, slug } = await params
  setRequestLocale(locale)

  const result = await resolvePublicSchedule(slug)
  if (!result) notFound()

  const t = await getTranslations('publicSchedule')
  const weekdayLabels = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [index + 1, t(`weekdays.${index + 1}`)])
  ) as Record<number, string>

  return (
    <div className="min-h-screen bg-alabaster-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <p className="text-sm font-medium text-primary">{result.school.name}</p>
          <h1 className="mt-1 text-3xl font-bold text-graphite">{t('title')}</h1>
          {result.period && (
            <p className="mt-2 text-graphite-600">{t('period', { period: result.period.name })}</p>
          )}
        </header>
        {result.slots.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t('empty')} />
        ) : (
          <ScheduleGrid
            slots={result.slots}
            weekdayLabels={weekdayLabels}
            noTeachersLabel={t('noTeachers')}
            contentLabel={t('content')}
            durationUnits={{ hours: t('duration.hours'), minutes: t('duration.minutes') }}
            classes={[]}
            teachersByClass={{}}
            isAdmin={false}
          />
        )}
      </div>
    </div>
  )
}
