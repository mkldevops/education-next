import { getTranslations } from 'next-intl/server'
import {
  EVENT_CALENDAR_CATEGORIES,
  type EventCalendarMonth,
  isPastEventCalendarMonth,
} from '@/domain/event-calendar'
import { cn } from '@/lib/utils'
import { EVENT_CATEGORY_COLORS } from './event-category-colors'

type Props = {
  months: EventCalendarMonth[]
  locale: string
  className?: string
  /**
   * Vue interactive (page publique) : entoure ce jour, fait de chaque jour coloré un lien
   * `#event-{id}` et, sur mobile, replie les mois écoulés derrière `pastMonthsLabel`.
   */
  interactive?: { today: Date; pastMonthsLabel: string }
}

/** Lundi 2 janvier 2023 : point de départ pour nommer les jours de la semaine dans la locale. */
const MONDAY = Date.UTC(2023, 0, 2)
const COLUMNS = [0, 1, 2, 3, 4, 5, 6] as const

export async function EventsOverviewCalendar({ months, locale, className, interactive }: Props) {
  const tCategory = await getTranslations('eventCategory')
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' })
  const weekdays = COLUMNS.map((column) =>
    weekdayLabel.format(new Date(MONDAY + column * 24 * 60 * 60 * 1000))
  )
  const used = new Set(
    months.flatMap((m) => m.weeks.flat().flatMap((day) => day?.categories ?? []))
  )
  const legend = EVENT_CALENDAR_CATEGORIES.filter((category) => used.has(category))

  const today = interactive?.today
  const isPast = (month: EventCalendarMonth) =>
    today !== undefined && isPastEventCalendarMonth(month, today)
  const pastCount = months.filter(isPast).length
  // Tout replier ne laisserait rien à l'écran : une année écoulée reste dépliée.
  const collapsePast = pastCount > 0 && pastCount < months.length
  const isToday = (month: EventCalendarMonth, day: number) =>
    today !== undefined &&
    month.year === today.getUTCFullYear() &&
    month.month === today.getUTCMonth() &&
    day === today.getUTCDate()

  return (
    <div className={cn('group/calendar space-y-4', className)}>
      {collapsePast && interactive && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-graphite-600 sm:hidden">
          <input type="checkbox" className="accent-primary" />
          {interactive.pastMonthsLabel}
        </label>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-4 print:gap-x-[6mm] print:gap-y-[3mm]">
        {months.map((month) => (
          <section
            key={`${month.year}-${month.month}`}
            className={cn(
              'break-inside-avoid',
              collapsePast &&
                isPast(month) &&
                'max-sm:hidden max-sm:group-has-[input:checked]/calendar:block'
            )}
          >
            <h3 className="mb-1 text-center text-sm font-semibold print:mb-[1mm] print:text-[9pt] capitalize text-graphite">
              {monthLabel.format(new Date(Date.UTC(month.year, month.month, 1)))}
            </h3>
            <table className="w-full table-fixed border-collapse text-center text-xs">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  {COLUMNS.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="py-1 font-semibold print:py-[0.6mm] print:text-[7.5pt]"
                    >
                      {weekdays[column]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {month.weeks.map((week) => (
                  <tr key={week.find(Boolean)?.day}>
                    {COLUMNS.map((column) => {
                      const day = week[column]
                      const [main, second] = day?.categories ?? []
                      const current = day ? isToday(month, day.day) : false
                      const label = (
                        <span
                          className={cn(
                            current &&
                              'inline-flex size-5 items-center justify-center rounded-full font-semibold ring-2 ring-graphite'
                          )}
                        >
                          {day?.day}
                        </span>
                      )
                      return (
                        <td
                          key={column}
                          title={day?.titles.join(' · ') || undefined}
                          aria-current={current ? 'date' : undefined}
                          className={cn(
                            'relative h-6 border border-alabaster-700 tabular-nums print:h-[5.5mm] print:text-[8.5pt]',
                            main ? EVENT_CATEGORY_COLORS[main].cell : 'text-graphite',
                            !day && 'bg-alabaster-900'
                          )}
                        >
                          {interactive && day?.eventId ? (
                            <a
                              href={`#event-${day.eventId}`}
                              aria-label={`${day.day} : ${day.titles.join(' · ')}`}
                              className="flex size-full items-center justify-center hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              {label}
                            </a>
                          ) : (
                            label
                          )}
                          {second && (
                            <span
                              aria-hidden="true"
                              className={cn(
                                'absolute right-0.5 top-0.5 size-1.5 rounded-full ring-1 ring-white',
                                EVENT_CATEGORY_COLORS[second].dot
                              )}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      {legend.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-graphite">
          {legend.map((category) => (
            <li key={category} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('size-3 rounded-sm', EVENT_CATEGORY_COLORS[category].dot)}
              />
              {tCategory(category)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
