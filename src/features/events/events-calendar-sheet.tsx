import type { EventCalendarMonth } from '@/domain/event-calendar'
import { EventsOverviewCalendar } from './events-overview-calendar'

/** La feuille dessine ses marges : une seule page A4 paysage, couleurs conservées. */
export const EVENTS_CALENDAR_PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #fff !important; min-height: 0 !important; }
  .calendar-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`

type Props = {
  months: EventCalendarMonth[]
  locale: string
  logoUrl?: string | null
  heading: string
  subtitle: string
  emptyLabel: string
  footer?: string | null
}

export function EventsCalendarSheet({
  months,
  locale,
  logoUrl,
  heading,
  subtitle,
  emptyLabel,
  footer,
}: Props) {
  return (
    <div className="w-full max-w-full overflow-x-auto print:overflow-visible">
      <article className="calendar-sheet mx-auto flex min-h-[210mm] w-[297mm] flex-col print:h-[210mm] print:overflow-hidden bg-white px-[12mm] py-[10mm] text-graphite shadow-lg print:m-0 print:shadow-none">
        <header className="flex items-center gap-[5mm] border-b-2 border-primary pb-[4mm]">
          {logoUrl && (
            // biome-ignore lint/performance/noImgElement: dynamic logo URL from config
            <img src={logoUrl} alt="" className="h-[14mm] w-auto object-contain" />
          )}
          <div>
            <h1 className="text-[18pt] font-bold leading-tight text-primary">{heading}</h1>
            <p className="text-[11pt] text-graphite-600">{subtitle}</p>
          </div>
        </header>

        {months.length > 0 ? (
          <EventsOverviewCalendar months={months} locale={locale} className="mt-[5mm] flex-1" />
        ) : (
          <p className="mt-[10mm] text-center text-[12pt] text-graphite-600">{emptyLabel}</p>
        )}

        {footer && (
          <footer className="mt-auto pt-[3mm] text-center text-[9pt] text-graphite-600">
            {footer}
          </footer>
        )}
      </article>
    </div>
  )
}
