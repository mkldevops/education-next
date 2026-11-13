import { buttonVariants } from '@peaklab/ui'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { eventPeriodBounds } from '@/domain/event'
import { buildEventCalendar, eventCalendarRange } from '@/domain/event-calendar'
import { getSelectedPeriod } from '@/features/dashboard/period'
import { Link } from '@/i18n/routing'
import { getBrandingConfig } from '@/lib/branding'
import { db } from '@/lib/db'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { requireSchoolAdmin } from '../../../../(dashboard)/_lib/auth-helper'
import { restrictedPageMetadata } from '../../../../(dashboard)/_lib/page-metadata'
import { isEventCategory } from '../../../../(dashboard)/dashboard/events/_components/event-enum-values'
import { EventsOverviewCalendar } from '../../../../(dashboard)/dashboard/events/_components/events-overview-calendar'
import { PrintButton } from '../../../_components/print-button'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ category?: string }>
}

/** Même principe que l'affiche : la feuille dessine ses marges, une seule page A4 paysage. */
const CALENDAR_PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #fff !important; min-height: 0 !important; }
  .calendar-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return restrictedPageMetadata(locale, 'dashboard.pages.events.calendar.printTitle')
}

export default async function EventsCalendarPrintPage({ params, searchParams }: Props) {
  await connection()
  const { locale } = await params
  const { category } = await searchParams
  setRequestLocale(locale)

  const { schoolId } = await requireSchoolAdmin()

  const eventsConfig = await db.config.findFirst({
    where: { schoolId, name: EVENTS_CONFIG_KEY, isActive: true },
    select: { value: true },
  })
  if (eventsConfig?.value !== 'true') notFound()

  const selectedCategory = isEventCategory(category) ? category : undefined
  const [selectedPeriod, branding] = await Promise.all([
    getSelectedPeriod(schoolId),
    getBrandingConfig(schoolId),
  ])
  const bounds = selectedPeriod ? eventPeriodBounds(selectedPeriod) : null

  // Mêmes filtres que la liste du tableau de bord ; les annulés ne colorent aucun jour.
  const events = await db.event.findMany({
    where: {
      schoolId,
      isActive: true,
      status: { not: 'CANCELLED' },
      ...(selectedCategory ? { category: selectedCategory } : {}),
      ...(bounds
        ? {
            startAt: { lt: bounds.until },
            OR: [{ endAt: { gte: bounds.from } }, { endAt: null, startAt: { gte: bounds.from } }],
          }
        : {}),
    },
    select: { title: true, category: true, startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
  })

  const range = eventCalendarRange(events, bounds)
  const months = range ? buildEventCalendar(events, range) : []

  const t = await getTranslations('dashboard.pages.events.calendar')
  const { logoUrl, schoolName } = branding

  return (
    <>
      <style>{CALENDAR_PRINT_CSS}</style>
      <div className="flex flex-1 flex-col items-center gap-4 bg-alabaster-900 px-4 py-6 print:block print:bg-white print:p-0">
        <div className="flex w-full max-w-[297mm] flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            href="/dashboard/events"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
          <p className="text-xs text-graphite-600">{t('hint')}</p>
          <PrintButton label={t('print')} />
        </div>

        <div className="w-full max-w-full overflow-x-auto print:overflow-visible">
          <article className="calendar-sheet mx-auto flex min-h-[210mm] w-[297mm] flex-col print:h-[210mm] print:overflow-hidden bg-white px-[12mm] py-[10mm] text-graphite shadow-lg print:m-0 print:shadow-none">
            <header className="flex items-center gap-[5mm] border-b-2 border-primary pb-[4mm]">
              {logoUrl && (
                // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
                <img src={logoUrl} alt="" className="h-[14mm] w-auto object-contain" />
              )}
              <div>
                <h1 className="text-[18pt] font-bold leading-tight text-primary">
                  {selectedPeriod ? t('heading', { period: selectedPeriod.name }) : t('printTitle')}
                </h1>
                <p className="text-[11pt] text-graphite-600">{t('subtitle')}</p>
              </div>
            </header>

            {months.length > 0 ? (
              <EventsOverviewCalendar months={months} locale={locale} className="mt-[5mm] flex-1" />
            ) : (
              <p className="mt-[10mm] text-center text-[12pt] text-graphite-600">{t('empty')}</p>
            )}

            {schoolName && (
              <footer className="mt-auto pt-[3mm] text-center text-[9pt] text-graphite-600">
                {selectedPeriod ? `${schoolName} — ${selectedPeriod.name}` : schoolName}
              </footer>
            )}
          </article>
        </div>
      </div>
    </>
  )
}
