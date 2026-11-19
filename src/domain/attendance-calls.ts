import { isAttendanceClosed } from './attendance-closure'
import type { AttendanceFrequency } from './attendance-frequency'
import { type ExpectedAttendance, expectedAttendance } from './attendance-tracking'

type Slot = { id: string; classPeriodId: string; weekday: number; startTime: string }
type Session = {
  classPeriodId: string
  occurredOn: Date
  occurrenceKey: string
  status: 'DRAFT' | 'VALIDATED' | 'CANCELLED'
}
type Closure = { status: string; category: string; startAt: Date; endAt?: Date | null }

export type PlannedCall = {
  classPeriodId: string
  classScheduleSlotId: string
  occurrenceKey: string
  occurredOn: Date
  startTime: string
  state: 'missed' | 'todo'
}

export type ClassCallSummary = {
  late: number
  todayExpected: number
  todayDone: number
  todayPending: number
}

const DAY_MS = 86_400_000

function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * Appels prévus par le planning et pas encore commencés, du début de la plage jusqu'à aujourd'hui.
 * Un jour de fermeture n'attend aucun appel. Avant le premier appel enregistré d'une classe, la
 * classe n'utilisait pas encore le suivi : aucun oubli n'y est compté, sinon chaque école qui
 * active la fonction verrait des semaines d'appels « oubliés ». Aujourd'hui est toujours « à faire ».
 * Les appels commencés (brouillons) restent des séances : ils sont comptés en retard s'ils sont
 * passés, sans colonne prévue.
 */
export function attendanceCallPlan({
  from,
  to,
  today,
  slots,
  sessions,
  closures,
  frequency,
  trackedSince,
}: {
  from: Date
  to: Date
  today: Date
  slots: Slot[]
  sessions: Session[]
  closures: Closure[]
  frequency: AttendanceFrequency
  trackedSince: ReadonlyMap<string, Date>
}) {
  const todayDay = utcDay(today)
  const byDay = new Map<number, Session[]>()
  for (const session of sessions) {
    const key = utcDay(session.occurredOn).getTime()
    byDay.set(key, [...(byDay.get(key) ?? []), session])
  }
  const startTimes = new Map(slots.map((slot) => [slot.id, slot.startTime]))
  const coverDay = (items: ExpectedAttendance[], daySessions: Session[]) => {
    const coveredClasses = new Set<string>()
    return items.flatMap<ExpectedAttendance>((item) => {
      if (item.status !== 'NOT_STARTED') return [item]
      const dayCalls = daySessions.filter(
        (session) =>
          session.classPeriodId === item.classPeriodId &&
          (frequency === 'DAILY' || session.occurrenceKey === 'daily')
      )
      const call =
        dayCalls.find((session) => session.status === 'VALIDATED') ??
        dayCalls.find((session) => session.status === 'DRAFT')
      if (!call) return dayCalls.length > 0 && frequency === 'PER_SLOT' ? [] : [item]
      if (coveredClasses.has(item.classPeriodId)) return []
      coveredClasses.add(item.classPeriodId)
      return [{ ...item, status: call.status === 'VALIDATED' ? 'VALIDATED' : 'IN_PROGRESS' }]
    })
  }
  const expectedOn = (day: Date) => {
    const daySessions = byDay.get(day.getTime()) ?? []
    const items = coverDay(
      expectedAttendance(day, slots, daySessions, new Set(), frequency),
      daySessions
    )
    if (!isAttendanceClosed(closures, day)) return items
    return items.filter((item) => item.status !== 'NOT_STARTED')
  }

  const summaries = new Map<string, ClassCallSummary>()
  const summary = (classPeriodId: string) => {
    const current = summaries.get(classPeriodId) ?? {
      late: 0,
      todayExpected: 0,
      todayDone: 0,
      todayPending: 0,
    }
    summaries.set(classPeriodId, current)
    return current
  }

  for (const item of expectedOn(todayDay)) {
    const current = summary(item.classPeriodId)
    current.todayExpected += 1
    if (item.status === 'VALIDATED') current.todayDone += 1
    else current.todayPending += 1
  }

  const planned: PlannedCall[] = []
  const last = Math.min(utcDay(to).getTime(), todayDay.getTime())
  for (let time = utcDay(from).getTime(); time <= last; time += DAY_MS) {
    const day = new Date(time)
    const isToday = time === todayDay.getTime()
    for (const item of expectedOn(day)) {
      if (item.status === 'VALIDATED') continue
      const since = trackedSince.get(item.classPeriodId)
      const tracked = since !== undefined && utcDay(since).getTime() <= time
      if (!isToday && tracked) summary(item.classPeriodId).late += 1
      if (item.status !== 'NOT_STARTED' || (!isToday && !tracked)) continue
      planned.push({
        classPeriodId: item.classPeriodId,
        classScheduleSlotId: item.classScheduleSlotId,
        occurrenceKey: item.occurrenceKey,
        occurredOn: day,
        startTime: startTimes.get(item.classScheduleSlotId) ?? '',
        state: isToday ? 'todo' : 'missed',
      })
    }
  }

  return { planned, summaries }
}

export type ClassCallState = 'late' | 'todo' | 'done' | 'none'

export function classCallState(summary: ClassCallSummary | undefined): ClassCallState {
  if (!summary) return 'none'
  if (summary.late > 0) return 'late'
  if (summary.todayPending > 0) return 'todo'
  if (summary.todayDone > 0) return 'done'
  return 'none'
}

const STATE_ORDER: Record<ClassCallState, number> = { late: 0, todo: 1, done: 2, none: 3 }

/** Les classes qui attendent un appel passent devant, puis l'ordre alphabétique. */
export function compareClassCallState(
  a: { name: string; state: ClassCallState },
  b: { name: string; state: ClassCallState }
) {
  return STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name, 'fr')
}
