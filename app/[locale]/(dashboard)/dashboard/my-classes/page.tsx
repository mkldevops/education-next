import { Breadcrumbs } from '@peaklab/ui'
import { ArrowRight, CalendarDays, ClipboardCheck, GraduationCap } from 'lucide-react'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { Link } from '@/i18n/routing'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { requireTeacher } from '../../_lib/auth-helper'

export default async function MyClassesPage({ params }: { params: Promise<{ locale: string }> }) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dashboard.pages.myClasses')
  const tBreadcrumbs = await getTranslations('dashboard.breadcrumbs')
  const { schoolId, teacherId } = await requireTeacher()
  const [classes, attendanceConfig] = await Promise.all([
    db.classPeriod.findMany({
      where: { schoolId, isActive: true, teachers: { some: { teacherId } } },
      select: {
        id: true,
        name: true,
        level: { select: { name: true } },
        period: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.config.findFirst({
      where: { schoolId, name: ATTENDANCE_ENABLED_CONFIG_KEY },
      select: { value: true },
    }),
  ])
  const attendanceEnabled = readsAsOptedIn(attendanceConfig?.value)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Breadcrumbs
        items={[
          { label: tBreadcrumbs('dashboard'), href: '/dashboard', icon: 'home' },
          { label: t('title') },
        ]}
      />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-graphite">{t('title')}</h1>
          <p className="max-w-xl text-sm leading-relaxed text-graphite-600">
            {t(attendanceEnabled ? 'subtitle' : 'subtitleReadOnly')}
          </p>
        </div>
        <span className="rounded-full border border-alabaster-700 bg-white px-3 py-1.5 text-sm font-medium text-graphite-600">
          {t('count', { count: classes.length })}
        </span>
      </header>
      {classes.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-alabaster-700 bg-white px-6 py-14 text-center">
          <GraduationCap aria-hidden="true" className="mx-auto mb-4 size-10 text-primary" />
          <h2 className="font-semibold text-graphite">{t('emptyTitle')}</h2>
          <p className="mt-2 text-sm text-graphite-600">{t('empty')}</p>
        </section>
      ) : (
        <ul className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((classPeriod) => (
            <li
              key={classPeriod.id}
              className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-alabaster-700 bg-white shadow-sm motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-md"
            >
              <div className="flex-1 space-y-5 p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <GraduationCap aria-hidden="true" className="size-6" />
                  </span>
                  <span className="min-w-0 break-words rounded-lg bg-alabaster-900 px-3 py-1 text-sm font-medium text-graphite-600">
                    {classPeriod.level.name}
                  </span>
                </div>
                <div className="space-y-2">
                  <h2 className="break-words text-xl font-semibold tracking-tight text-graphite">
                    {classPeriod.name}
                  </h2>
                  <p className="flex items-center gap-2 text-sm text-graphite-600">
                    <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
                    <span className="min-w-0 break-words">{classPeriod.period.name}</span>
                  </p>
                </div>
              </div>
              {attendanceEnabled && (
                <div className="border-t border-alabaster-800 bg-alabaster-900/50 p-4">
                  <Link
                    className="group flex min-h-12 items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    href={`/dashboard/my-classes/${classPeriod.id}/attendance?date=${today}`}
                    aria-label={t('attendanceFor', { name: classPeriod.name })}
                  >
                    <span className="flex items-center gap-2">
                      <ClipboardCheck aria-hidden="true" className="size-4 shrink-0" />
                      {t('attendance')}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
                    />
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
