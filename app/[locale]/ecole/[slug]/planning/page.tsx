import { EmptyState } from '@peaklab/ui'
import { CalendarDays } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { cache } from 'react'
import { isPeriodCurrent } from '@/domain/period'
import { schoolGateway } from '@/gateways/school-gateway'
import { getPathname } from '@/i18n/routing'
import { getBrandingConfig } from '@/lib/branding'
import { db } from '@/lib/db'
import { listPublicClassSchedule } from '@/use-cases/class-schedules/list-public-class-schedule'
import { PrintButton } from '../../../(print)/_components/print-button'
import {
  collectLevels,
  LevelFilter,
  PublicTimetable,
  type PublicTimetableLabels,
} from './_components/public-timetable'
import { buildScheduleQrCode } from './_lib/schedule-qr-code'

const SCHEDULE_PRINT_CSS = `
@page { size: A4; margin: 12mm; }
@media print {
  html, body { background: #fff !important; min-height: 0 !important; }
  .schedule-print { print-color-adjust: exact; -webkit-print-color-adjust: exact; font-size: 11px; }
}
`

type Props = {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ niveau?: string | string[] }>
}

const resolvePublicSchedule = cache(async (slug: string) => {
  const school = await schoolGateway.findBySlug(slug)
  if (!school?.isActive) return null

  const periods = await db.period.findMany({
    where: { schoolId: school.id, isActive: true },
    select: { id: true, name: true, startAt: true, endAt: true },
    orderBy: { startAt: 'desc' },
  })
  const now = new Date()
  const period = periods.find((candidate) => isPeriodCurrent(candidate, now)) ?? periods[0]
  if (!period) return null

  const schedule = await listPublicClassSchedule(slug, period.id)
  if (schedule === 'notFound') return null
  const levelProgression = await db.level.findMany({
    where: { schoolId: school.id },
    select: { id: true, nextLevelId: true },
  })
  const { logoUrl } = await getBrandingConfig(school.id)
  return { school: schedule.school, logoUrl, period, slots: schedule.slots, levelProgression }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const result = await resolvePublicSchedule(slug)
  const t = await getTranslations({ locale, namespace: 'publicSchedule' })
  return result
    ? { title: t('metadata.title', { schoolName: result.school.name }) }
    : { title: t('notFoundTitle') }
}

export default async function PublicSchedulePage({ params, searchParams }: Props) {
  await connection()
  const { locale, slug } = await params
  setRequestLocale(locale)

  const result = await resolvePublicSchedule(slug)
  if (!result) notFound()

  const t = await getTranslations('publicSchedule')
  const levels = collectLevels(result.slots, result.levelProgression)
  const { niveau } = await searchParams
  const activeLevel = levels.find((level) => level.id === niveau) ?? null
  const slots = activeLevel
    ? result.slots.filter((slot) => slot.classPeriod.level.id === activeLevel.id)
    : result.slots
  const courseCounts = new Map<string, number>()
  for (const slot of result.slots) {
    const id = slot.classPeriod.level.id
    courseCounts.set(id, (courseCounts.get(id) ?? 0) + 1)
  }
  const dayCount = new Set(result.slots.map((slot) => slot.weekday)).size
  const basePath = `/ecole/${slug}/planning`
  const qrCode = await buildScheduleQrCode(
    getPathname({
      locale,
      href: activeLevel ? { pathname: basePath, query: { niveau: activeLevel.id } } : basePath,
    })
  )

  const labels: PublicTimetableLabels = {
    weekdays: Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [index + 1, t(`weekdays.${index + 1}`)])
    ),
    sessions: {
      morning: t('sessions.morning'),
      afternoon: t('sessions.afternoon'),
      evening: t('sessions.evening'),
    },
    level: t('level'),
    teacher: t('teacher'),
    teachers: t('teachers'),
    noTeachers: t('noTeachers'),
    program: t('program'),
    close: t('close'),
    programTitle: t('programTitle'),
    courses: (count) => t('courses', { count }),
    perWeek: (count) => t('filter.perWeek', { count }),
    allLevels: t('filter.all'),
    filterLabel: t('filter.label'),
  }

  return (
    <div className="schedule-print min-h-screen bg-alabaster-900 print:min-h-0 print:bg-white">
      <style>{SCHEDULE_PRINT_CSS}</style>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        <header className="mb-6 flex items-start justify-between gap-6 print:mb-4 print:border-b-2 print:border-graphite print:pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              {result.logoUrl && (
                // biome-ignore lint/performance/noImgElement: school logos are arbitrary remote URLs
                <img
                  src={result.logoUrl}
                  alt={t('logoAlt', { schoolName: result.school.name })}
                  className="size-16 shrink-0 rounded-xl border border-alabaster-700 bg-white object-contain p-1.5 sm:size-20 print:size-[18mm] print:rounded-none print:border-0 print:p-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                  {result.school.name}
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-graphite sm:text-4xl print:text-2xl">
                  {t('title')}
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-graphite-600 print:hidden">
              {t('intro', { period: result.period.name })}
            </p>
            <p className="mt-1 hidden text-sm text-graphite-600 print:block">
              {activeLevel
                ? t('print.levelPeriod', { level: activeLevel.name, period: result.period.name })
                : t('print.period', { period: result.period.name })}
            </p>
            {result.slots.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 print:hidden">
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <Stat value={dayCount} label={t('stats.days', { count: dayCount })} />
                  <Stat value={levels.length} label={t('stats.levels', { count: levels.length })} />
                  <Stat
                    value={result.slots.length}
                    label={t('stats.courses', { count: result.slots.length })}
                  />
                </dl>
                <PrintButton label={t('print.button')} />
              </div>
            )}
          </div>
          {qrCode && (
            <figure className="hidden shrink-0 flex-col items-center gap-1.5 rounded-xl border border-alabaster-700 bg-white p-3 lg:flex print:flex print:rounded-none print:border-0 print:p-0">
              {/* biome-ignore lint/performance/noImgElement: inline SVG data URL generated server-side */}
              <img src={qrCode.src} alt={t('print.qrAlt')} className="size-20 print:size-[26mm]" />
              <figcaption className="max-w-24 text-center text-[0.65rem] leading-snug text-graphite-600 print:max-w-[34mm]">
                {t('print.qrCaption')}
              </figcaption>
            </figure>
          )}
        </header>
        {result.slots.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t('empty')} />
        ) : (
          <>
            <section
              aria-labelledby="level-picker"
              className="mb-6 rounded-2xl border-2 border-primary/25 bg-white p-4 shadow-sm sm:p-5 print:hidden"
            >
              <h2 id="level-picker" className="text-xl font-bold text-graphite">
                {t('filter.hint')}
              </h2>
              <p className="mt-1 mb-4 text-sm text-graphite-600">{t('filter.intro')}</p>
              <LevelFilter
                levels={levels}
                courseCounts={courseCounts}
                activeLevelId={activeLevel?.id ?? null}
                basePath={basePath}
                labels={labels}
              />
            </section>
            <PublicTimetable
              slots={slots}
              levels={levels}
              labels={labels}
              focused={activeLevel !== null}
            />
            {qrCode && (
              <p className="mt-6 hidden border-t border-alabaster-700 pt-3 text-xs text-graphite-600 print:block">
                {t('print.footer', { url: qrCode.url })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="sr-only">{label}</dt>
      <dd className="font-mono text-2xl font-semibold tabular-nums text-graphite">{value}</dd>
      <dd className="text-graphite-600">{label}</dd>
    </div>
  )
}
