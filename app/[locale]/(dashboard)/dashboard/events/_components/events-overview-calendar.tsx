import { getTranslations } from 'next-intl/server'
import { EVENT_CALENDAR_CATEGORIES, type EventCalendarMonth } from '@/domain/event-calendar'
import { cn } from '@/lib/utils'
import { EVENT_CATEGORY_COLORS } from './event-category-colors'

type Props = {
  months: EventCalendarMonth[]
  locale: string
  className?: string
}

/** Lundi 2 janvier 2023 : point de départ pour nommer les jours de la semaine dans la locale. */
const MONDAY = Date.UTC(2023, 0, 2)
const COLUMNS = [0, 1, 2, 3, 4, 5, 6] as const

export async function EventsOverviewCalendar({ months, locale, className }: Props) {
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

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-4 print:gap-x-[6mm] print:gap-y-[3mm]">
        {months.map((month) => (
          <section key={`${month.year}-${month.month}`} className="break-inside-avoid">
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
                      return (
                        <td
                          key={column}
                          title={day?.titles.join(' · ') || undefined}
                          className={cn(
                            'relative h-6 border border-alabaster-700 tabular-nums print:h-[5.5mm] print:text-[8.5pt]',
                            main ? EVENT_CATEGORY_COLORS[main].cell : 'text-graphite',
                            !day && 'bg-alabaster-900'
                          )}
                        >
                          {day?.day}
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
