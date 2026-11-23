import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import { buttonVariants } from '@/components/ui/button'
import { eventPeriodBounds } from '@/domain/event'
import { buildEventCalendar, eventCalendarRange } from '@/domain/event-calendar'
import { getDefaultPeriod } from '@/features/dashboard/period'
import { EVENTS_CALENDAR_PRINT_CSS, EventsCalendarSheet } from '@/features/events'
import { Link } from '@/i18n/routing'
import { getBrandingConfig } from '@/lib/branding'
import { getThemeConfigs } from '@/lib/theme-configs'
import { listPublicEvents } from '@/use-cases/events/list-public-events'
import { PrintButton } from '../../../(print)/_components/print-button'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const result = await listPublicEvents(slug)

  if (result === 'notFound' || result === 'notConfigured') {
    const t = await getTranslations({ locale, namespace: 'errorPages' })
    return { title: t('404.title') }
  }

  const t = await getTranslations({ locale, namespace: 'publicEvents' })
  return { title: t('printTitle', { schoolName: result.school.name }) }
}

/**
 * Version imprimable de la vue d'ensemble publique : mêmes événements que la page
 * `/evenements` (publics, annulés exclus), sur une feuille A4 paysage.
 */
export default async function PublicEventsCalendarPage({ params }: Props) {
  await connection()
  const { locale, slug } = await params
  setRequestLocale(locale)

  const result = await listPublicEvents(slug)
  if (result === 'notFound' || result === 'notConfigured') notFound()

  const { school, events } = result
  const [themeConfigs, branding, period, t] = await Promise.all([
    getThemeConfigs(school.id),
    getBrandingConfig(school.id),
    getDefaultPeriod(school.id),
    getTranslations('publicEvents'),
  ])

  const calendarEvents = events.filter((event) => event.status !== 'CANCELLED')
  const range = period ? eventCalendarRange(calendarEvents, eventPeriodBounds(period)) : null
  const months = range ? buildEventCalendar(calendarEvents, range) : []

  return (
    <>
      <ThemeProvider configs={themeConfigs} />
      <style>{EVENTS_CALENDAR_PRINT_CSS}</style>
      <div className="flex min-h-screen flex-col items-center gap-4 bg-alabaster-900 px-4 py-6 print:block print:min-h-0 print:bg-white print:p-0">
        <div className="flex w-full max-w-[297mm] flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            href={`/ecole/${school.slug}/evenements`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
          <p className="text-xs text-graphite-600">{t('printHint')}</p>
          <PrintButton label={t('print')} />
        </div>

        <EventsCalendarSheet
          months={months}
          locale={locale}
          logoUrl={branding.logoUrl}
          heading={period ? t('printHeading', { period: period.name }) : t('title')}
          subtitle={t('printSubtitle')}
          emptyLabel={t('printEmpty')}
          footer={period ? `${school.name} — ${period.name}` : school.name}
        />
      </div>
    </>
  )
}
