import { BookOpen, Moon, Sun, Sunrise, UserRound, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { RichDescription } from '../../../../(dashboard)/dashboard/planning/_components/schedule-grid'
import {
  assignLanes,
  axisBounds,
  groupByTimeRange,
  printLabelEm,
  printMinutesPerEm,
  toMinutes,
} from '../_lib/timetable-layout'

export type PublicSlot = {
  id: string
  weekday: number
  startTime: string
  endTime: string
  description: string | null
  classPeriod: { id: string; level: { id: string; name: string } }
  teachers: Array<{ teacher: { id: string; firstName: string; lastName: string } }>
}

export type PublicLevel = { id: string; name: string; tone: string }

type Session = 'morning' | 'afternoon' | 'evening'
const SESSION_ICONS = { morning: Sunrise, afternoon: Sun, evening: Moon } satisfies Record<
  Session,
  unknown
>

export type PublicTimetableLabels = {
  weekdays: Record<number, string>
  sessions: Record<Session, string>
  level: string
  teacher: string
  teachers: string
  noTeachers: string
  program: string
  close: string
  programTitle: string
  courses: (count: number) => string
  perWeek: (count: number) => string
  allLevels: string
  filterLabel: string
}

const LEVEL_TONES = ['#0e7490', '#b45309', '#be123c', '#4d7c0f', '#6d28d9', '#1d4ed8', '#c2410c']

/**
 * Niveaux du planning, rangés par profondeur dans la progression : un niveau vient après tous
 * ceux qui y mènent, et les branches d'une progression qui se divise se rangent par nom.
 */
export function collectLevels(
  slots: PublicSlot[],
  progression: Array<{ levelId: string; nextLevelId: string }>
): PublicLevel[] {
  const levels = new Map<string, string>()
  for (const slot of slots) levels.set(slot.classPeriod.level.id, slot.classPeriod.level.name)

  const nextIdsById = new Map<string, string[]>()
  for (const { levelId, nextLevelId } of progression) {
    nextIdsById.set(levelId, [...(nextIdsById.get(levelId) ?? []), nextLevelId])
  }
  const targets = new Set(progression.map((edge) => edge.nextLevelId))
  const rank = new Map<string, number>()
  const visit = (id: string, depth: number) => {
    if ((rank.get(id) ?? -1) >= depth) return
    rank.set(id, depth)
    for (const nextId of nextIdsById.get(id) ?? []) visit(nextId, depth + 1)
  }
  for (const id of new Set([...nextIdsById.keys(), ...levels.keys()])) {
    if (!targets.has(id)) visit(id, 0)
  }

  return [...levels.entries()]
    .sort(
      ([idA, nameA], [idB, nameB]) =>
        (rank.get(idA) ?? Number.MAX_SAFE_INTEGER) - (rank.get(idB) ?? Number.MAX_SAFE_INTEGER) ||
        nameA.localeCompare(nameB, undefined, { numeric: true })
    )
    .map(([id, name], index) => ({ id, name, tone: LEVEL_TONES[index % LEVEL_TONES.length] }))
}

function sessionOf(startTime: string): Session {
  const hour = Number(startTime.slice(0, 2))
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function toneStyle(tone: string) {
  return { '--tone': tone } as CSSProperties
}

type FilterProps = {
  levels: PublicLevel[]
  courseCounts: Map<string, number>
  activeLevelId: string | null
  basePath: string
  labels: PublicTimetableLabels
}

export function LevelFilter({
  levels,
  courseCounts,
  activeLevelId,
  basePath,
  labels,
}: FilterProps) {
  const option =
    'flex min-w-24 flex-col rounded-xl border-2 px-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tone)]'
  const total = [...courseCounts.values()].reduce((sum, count) => sum + count, 0)
  return (
    <nav aria-label={labels.filterLabel} className="flex flex-wrap gap-2">
      {levels.map((level) => {
        const active = level.id === activeLevelId
        return (
          <Link
            key={level.id}
            href={{ pathname: basePath, query: { niveau: level.id } }}
            aria-current={active ? 'page' : undefined}
            style={toneStyle(level.tone)}
            className={cn(
              option,
              active
                ? 'border-[var(--tone)] bg-[var(--tone)] text-white'
                : 'border-alabaster-700 bg-white text-graphite hover:border-[var(--tone)]'
            )}
          >
            <span className="flex items-center gap-2 text-lg font-bold leading-tight">
              <span
                aria-hidden="true"
                className={cn('size-2.5 rounded-full', active ? 'bg-white' : 'bg-[var(--tone)]')}
              />
              {level.name}
            </span>
            <span className={cn('text-xs', active ? 'text-white/85' : 'text-graphite-600')}>
              {labels.perWeek(courseCounts.get(level.id) ?? 0)}
            </span>
          </Link>
        )
      })}
      <Link
        href={basePath}
        aria-current={activeLevelId === null ? 'page' : undefined}
        style={toneStyle('var(--color-graphite)')}
        className={cn(
          option,
          activeLevelId === null
            ? 'border-graphite bg-graphite text-white'
            : 'border-dashed border-alabaster-700 bg-transparent text-graphite-600 hover:border-graphite hover:text-graphite'
        )}
      >
        <span className="text-lg font-bold leading-tight">{labels.allLevels}</span>
        <span className={cn('text-xs', activeLevelId === null ? 'text-white/85' : '')}>
          {labels.perWeek(total)}
        </span>
      </Link>
    </nav>
  )
}

type TimetableProps = {
  slots: PublicSlot[]
  levels: PublicLevel[]
  labels: PublicTimetableLabels
  focused: boolean
}

type TimeRange = ReturnType<typeof groupByTimeRange<PublicSlot>>[number]

const SCREEN_ITEM_PX = { compact: 34, focused: 150 }
const SCREEN_BLOCK_PX = 40
const SCREEN_MIN_PX_PER_MINUTE = 1.2

function pixelsPerMinute(ranges: TimeRange[], itemPx: number) {
  return ranges.reduce(
    (max, range) =>
      Math.max(
        max,
        (SCREEN_BLOCK_PX + range.slots.length * itemPx) /
          (toMinutes(range.endTime) - toMinutes(range.startTime))
      ),
    SCREEN_MIN_PX_PER_MINUTE
  )
}

export function PublicTimetable({ slots, levels, labels, focused }: TimetableProps) {
  const toneByLevel = new Map(levels.map((level) => [level.id, level.tone]))
  const orderByLevel = new Map(levels.map((level, index) => [level.id, index]))
  const weekdays = Array.from(new Set(slots.map((slot) => slot.weekday))).sort((a, b) => a - b)
  const days = weekdays.map((weekday) => {
    const daySlots = slots.filter((slot) => slot.weekday === weekday)
    const ranges = groupByTimeRange(daySlots).map((range) => ({
      ...range,
      slots: [...range.slots].sort(
        (a, b) =>
          (orderByLevel.get(a.classPeriod.level.id) ?? 0) -
          (orderByLevel.get(b.classPeriod.level.id) ?? 0)
      ),
    }))
    return { weekday, count: daySlots.length, ranges }
  })
  const toneOf = (slot: PublicSlot) => toneByLevel.get(slot.classPeriod.level.id) ?? LEVEL_TONES[0]

  return (
    <>
      <WeekCalendar days={days} labels={labels} toneOf={toneOf} focused={focused} />
      <DayList days={days} labels={labels} toneOf={toneOf} focused={focused} />
    </>
  )
}

type Day = { weekday: number; count: number; ranges: TimeRange[] }
type ViewProps = {
  days: Day[]
  labels: PublicTimetableLabels
  toneOf: (slot: PublicSlot) => string
  focused: boolean
}

function WeekCalendar({ days, labels, toneOf, focused }: ViewProps) {
  const ranges = days.flatMap((day) => day.ranges)
  const { start: axisStart, end: axisEnd } = axisBounds(ranges)
  const labelEm = printLabelEm(
    ranges.flatMap((range) => range.slots),
    focused
  )
  const hours = Array.from({ length: (axisEnd - axisStart) / 60 + 1 }, (_, i) => axisStart / 60 + i)
  const scale = {
    '--m-screen': `${pixelsPerMinute(ranges, focused ? SCREEN_ITEM_PX.focused : SCREEN_ITEM_PX.compact)}px`,
    '--m-print': 'calc(100cqh / var(--axis))',
    '--fs-print': `clamp(9px, min(var(--m) * ${printMinutesPerEm(ranges, focused).toFixed(3)}, 100cqw / (var(--lanes, 1) * ${labelEm.toFixed(2)})), 20px)`,
    '--axis': axisEnd - axisStart,
  } as CSSProperties
  const at = (minutes: number) => `calc(var(--m) * ${minutes - axisStart})`
  const sessionStarts = new Map<number, Session>()
  for (const hour of hours) {
    const session = sessionOf(`${String(hour).padStart(2, '0')}:00`)
    if (![...sessionStarts.values()].includes(session)) sessionStarts.set(hour, session)
  }

  return (
    <div
      style={scale}
      className="hidden rounded-2xl border border-alabaster-700 bg-white [--m:var(--m-screen)] md:block print:flex print:min-h-0 print:flex-1 print:flex-col print:rounded-none print:border-0 print:[--m:var(--m-print)]"
    >
      <div
        className="grid print:min-h-0 print:flex-1 print:grid-rows-[auto_minmax(0,1fr)]"
        style={{ gridTemplateColumns: `5.25rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="border-b-2 border-graphite" />
        {days.map((day) => (
          <div
            key={day.weekday}
            className="border-b-2 border-l border-graphite border-l-alabaster-700 px-3 py-2.5 print:px-2 print:py-1.5"
          >
            <h2 className="text-base font-bold text-graphite print:text-lg">
              {labels.weekdays[day.weekday]}
            </h2>
            <p className="text-xs text-graphite-600">{labels.courses(day.count)}</p>
          </div>
        ))}

        <div className="relative my-3 h-[calc(var(--m)*var(--axis))] print:my-2 print:h-auto print:[container-type:size]">
          {hours.map((hour) => {
            const session = sessionStarts.get(hour)
            const SessionIcon = session ? SESSION_ICONS[session] : null
            return (
              <div
                key={hour}
                style={{ top: at(hour * 60) }}
                className="absolute inset-x-0 -translate-y-2 pr-2 text-right print:-translate-y-1.5"
              >
                <p className="font-mono text-xs tabular-nums text-graphite-600 print:text-[11px]">
                  {String(hour).padStart(2, '0')}:00
                </p>
                {session && SessionIcon && (
                  <p className="flex items-center justify-end gap-0.5 whitespace-nowrap text-[0.6rem] font-semibold uppercase tracking-wider text-foreground print:text-[9px]">
                    <SessionIcon aria-hidden="true" className="size-2.5" />
                    {labels.sessions[session]}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {days.map((day) => {
          const { placed, laneCount } = assignLanes(day.ranges)
          return (
            <section
              key={day.weekday}
              aria-label={labels.weekdays[day.weekday]}
              style={{ '--lanes': laneCount } as CSSProperties}
              className="relative my-3 h-[calc(var(--m)*var(--axis))] border-l border-alabaster-700 print:my-2 print:h-auto print:[container-type:size]"
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  aria-hidden="true"
                  style={{ top: at(hour * 60) }}
                  className="absolute inset-x-0 border-t border-dashed border-alabaster-700"
                />
              ))}
              {placed.map(({ range, lane }) => (
                <div
                  key={range.key}
                  style={{
                    top: at(toMinutes(range.startTime)),
                    height: `calc(var(--m) * ${toMinutes(range.endTime) - toMinutes(range.startTime)})`,
                    left: `calc(${(lane / laneCount) * 100}% + 0.375rem)`,
                    width: `calc(${100 / laneCount}% - 0.75rem)`,
                  }}
                  className="absolute flex flex-col gap-1.5 overflow-hidden rounded-xl bg-alabaster-900 p-2 ring-1 ring-alabaster-700 print:gap-[0.3em] print:rounded-md print:p-[0.45em] print:text-[length:var(--fs-print)]"
                >
                  <p className="whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-graphite print:text-[0.85em]">
                    {range.startTime}–{range.endTime}
                  </p>
                  <ul className="flex flex-col gap-1 print:gap-[0.3em]">
                    {range.slots.map((slot) =>
                      focused ? (
                        <SlotDetail
                          key={slot.id}
                          slot={slot}
                          tone={toneOf(slot)}
                          labels={labels}
                          compact
                        />
                      ) : (
                        <SlotChip
                          key={slot.id}
                          slot={slot}
                          tone={toneOf(slot)}
                          labels={labels}
                          popover
                        />
                      )
                    )}
                  </ul>
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function DayList({ days, labels, toneOf, focused }: ViewProps) {
  return (
    <div className="space-y-8 md:hidden print:hidden">
      {days.map((day) => (
        <section key={day.weekday} aria-labelledby={`day-${day.weekday}`}>
          <header className="flex items-baseline justify-between gap-4 border-b-2 border-graphite pb-2">
            <h2 id={`day-${day.weekday}`} className="text-2xl font-bold text-graphite">
              {labels.weekdays[day.weekday]}
            </h2>
            <p className="text-sm font-medium text-graphite-600">{labels.courses(day.count)}</p>
          </header>
          <div className="divide-y divide-alabaster-700">
            {day.ranges.map((range) => {
              const session = sessionOf(range.startTime)
              const SessionIcon = SESSION_ICONS[session]
              return (
                <div key={range.key} className="space-y-2 py-4">
                  <p className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                      <SessionIcon aria-hidden="true" className="size-3.5" />
                      {labels.sessions[session]}
                    </span>
                    <span className="font-mono text-base font-semibold tabular-nums text-graphite">
                      {range.startTime}–{range.endTime}
                    </span>
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {range.slots.map((slot) =>
                      focused ? (
                        <SlotDetail key={slot.id} slot={slot} tone={toneOf(slot)} labels={labels} />
                      ) : (
                        <SlotChip key={slot.id} slot={slot} tone={toneOf(slot)} labels={labels} />
                      )
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function SlotChip({
  slot,
  tone,
  labels,
  popover = false,
}: {
  slot: PublicSlot
  tone: string
  labels: PublicTimetableLabels
  popover?: boolean
}) {
  const teacherNames = slot.teachers.map(({ teacher }) =>
    `${teacher.firstName} ${teacher.lastName}`.trim()
  )
  const content = (
    <>
      <span className="shrink-0 font-bold text-graphite">
        <span className="sr-only">{labels.level} </span>
        {slot.classPeriod.level.name}
      </span>
      {teacherNames.length > 0 ? (
        <span className="min-w-0 truncate text-graphite-600">
          <span className="sr-only">
            {teacherNames.length > 1 ? labels.teachers : labels.teacher} :{' '}
          </span>
          {teacherNames.join(', ')}
        </span>
      ) : (
        <span className="min-w-0 truncate italic text-graphite-600">{labels.noTeachers}</span>
      )}
    </>
  )
  const chip =
    'flex max-w-full items-center gap-1.5 rounded-md border border-l-4 border-alabaster-700 border-l-[var(--tone)] bg-white px-2 py-1 text-sm print:gap-[0.35em] print:px-[0.4em] print:py-[0.15em] print:text-[1em]'

  if (!slot.description) {
    return (
      <li style={toneStyle(tone)} className={chip}>
        {content}
      </li>
    )
  }

  if (popover) {
    const popoverId = `program-${slot.id}`
    const anchorName = `--slot-${slot.id}`
    return (
      <li style={{ ...toneStyle(tone), anchorName } as CSSProperties} className="max-w-full">
        <button
          type="button"
          popoverTarget={popoverId}
          title={labels.program}
          className={cn(chip, 'w-full cursor-pointer text-left hover:border-[var(--tone)]')}
        >
          {content}
          <BookOpen
            aria-hidden="true"
            className="ml-auto size-3.5 shrink-0 text-[var(--tone)] print:hidden"
          />
          <span className="sr-only">{labels.program}</span>
        </button>
        <div
          id={popoverId}
          popover="auto"
          style={
            {
              positionAnchor: anchorName,
              positionArea: 'bottom span-right',
              positionTryFallbacks: 'flip-block, flip-inline, flip-block flip-inline',
            } as CSSProperties
          }
          className="m-0 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-alabaster-700 border-t-4 border-t-[var(--tone)] bg-white p-4 text-left shadow-xl print:hidden"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-graphite">{slot.classPeriod.level.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-graphite-600">
                <UserRound aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{teacherLabel(slot, labels)}</span>
              </p>
            </div>
            <button
              type="button"
              popoverTarget={popoverId}
              popoverTargetAction="hide"
              aria-label={labels.close}
              className="-mt-1 -mr-1 rounded-md p-1 text-graphite-600 transition-colors hover:bg-alabaster-900 hover:text-graphite"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--tone)]">
            {labels.programTitle}
          </p>
          <div className="[&>div]:mt-1 [&>div]:bg-transparent [&>div]:p-0">
            <RichDescription value={slot.description} />
          </div>
        </div>
      </li>
    )
  }

  return (
    <li style={toneStyle(tone)} className="max-w-full has-[details[open]]:basis-full">
      <details className="group">
        <summary
          title={labels.program}
          className={cn(chip, 'cursor-pointer list-none marker:hidden hover:border-[var(--tone)]')}
        >
          {content}
          <BookOpen
            aria-hidden="true"
            className="ml-auto size-3.5 shrink-0 text-[var(--tone)] print:hidden"
          />
          <span className="sr-only">{labels.program}</span>
        </summary>
        <div className="print:hidden">
          <RichDescription value={slot.description} />
        </div>
      </details>
    </li>
  )
}

function teacherLabel(slot: PublicSlot, labels: PublicTimetableLabels) {
  const names = slot.teachers.map(({ teacher }) =>
    `${teacher.firstName} ${teacher.lastName}`.trim()
  )
  return names.length > 0 ? names.join(', ') : labels.noTeachers
}

function SlotDetail({
  slot,
  tone,
  labels,
  compact = false,
}: {
  slot: PublicSlot
  tone: string
  labels: PublicTimetableLabels
  compact?: boolean
}) {
  return (
    <li
      style={toneStyle(tone)}
      className="w-full list-none rounded-lg border border-l-4 border-alabaster-700 border-l-[var(--tone)] bg-white p-3 print:p-[0.5em]"
    >
      <p className="text-lg font-bold leading-tight text-graphite print:text-[1.15em]">
        <span className="sr-only">{labels.level} </span>
        {slot.classPeriod.level.name}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-graphite-600 print:mt-0 print:text-[0.9em]">
        <UserRound aria-hidden="true" className="size-3.5 shrink-0 print:size-[1em]" />
        <span className="sr-only">
          {slot.teachers.length > 1 ? labels.teachers : labels.teacher} :{' '}
        </span>
        <span className="truncate">{teacherLabel(slot, labels)}</span>
      </p>
      {slot.description && (
        <div
          className={cn(
            'mt-2 border-t border-alabaster-700 pt-2 text-xs text-graphite-600 print:mt-1 print:pt-1 print:text-[0.8em] [&>div]:m-0 [&>div]:bg-transparent [&>div]:p-0 [&>div]:text-xs print:[&>div]:text-[1em]',
            compact && 'line-clamp-4 print:line-clamp-3'
          )}
        >
          <p className="sr-only">{labels.program}</p>
          <RichDescription value={slot.description} />
        </div>
      )}
    </li>
  )
}
