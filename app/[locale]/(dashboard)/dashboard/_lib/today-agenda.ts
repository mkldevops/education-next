import { isAttendanceClosed } from '@/domain/attendance-closure'
import { type ExpectedAttendance, expectedAttendance } from '@/domain/attendance-tracking'
import { planningWeekday } from '@/domain/current-week-dates'
import { DAY_MS, utcStartOfDay } from '@/domain/day'
import { db } from '@/lib/db'

export type TodayClass = {
  slotId: string
  classPeriodId: string
  className: string
  startTime: string
  endTime: string
  teachers: string[]
  /** `null` quand l'appel est désactivé : le créneau ne se lit alors que comme un cours. */
  attendance: ExpectedAttendance['status'] | null
}

export type TodayAgenda = {
  closed: boolean
  classes: TodayClass[]
  attendanceToTake: number
}

type AgendaOptions = {
  periodId: string | null
  attendanceEnabled: boolean
  scheduleEnabled: boolean
}

/**
 * Cours du jour d'une école et appels qu'il reste à valider, sur la période sélectionnée.
 *
 * Même convention que la page d'appel : la journée est le quantième UTC, une séance annulée
 * retire le créneau, et un jour de fermeture ne garde que les créneaux déjà ouverts. Sans
 * période ni fonctionnalité de planning ou d'appel, aucune lecture n'est faite.
 */
export async function getTodayAgenda(
  schoolId: string,
  { periodId, attendanceEnabled, scheduleEnabled }: AgendaOptions,
  reference: Date = new Date()
): Promise<TodayAgenda | null> {
  if (!periodId || (!attendanceEnabled && !scheduleEnabled)) return null

  const day = utcStartOfDay(reference)
  const classPeriod = { periodId, isActive: true }

  const [slots, sessions, closures] = await Promise.all([
    db.classScheduleSlot.findMany({
      where: { schoolId, weekday: planningWeekday(day), classPeriod },
      select: {
        id: true,
        classPeriodId: true,
        weekday: true,
        startTime: true,
        endTime: true,
        classPeriod: { select: { name: true } },
        teachers: {
          where: { teacher: { isActive: true } },
          select: { teacher: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: [{ startTime: 'asc' }, { classPeriod: { name: 'asc' } }],
    }),
    attendanceEnabled
      ? db.attendanceSession.findMany({
          where: { schoolId, occurredOn: day, classPeriod },
          select: { classPeriodId: true, occurrenceKey: true, status: true },
        })
      : Promise.resolve([]),
    db.event.findMany({
      where: {
        schoolId,
        isActive: true,
        status: 'PUBLISHED',
        category: 'CLOSURE',
        startAt: { lt: new Date(day.getTime() + DAY_MS) },
        OR: [{ endAt: null }, { endAt: { gte: day } }],
      },
      select: { status: true, category: true, startAt: true, endAt: true },
    }),
  ])

  const closed = isAttendanceClosed(closures, day)
  const openSlots = closed
    ? slots.filter((slot) =>
        sessions.some(
          (session) =>
            session.classPeriodId === slot.classPeriodId && session.occurrenceKey === slot.id
        )
      )
    : slots
  const expected = expectedAttendance(day, openSlots, sessions)
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]))

  const classes = expected.flatMap<TodayClass>((occurrence) => {
    const slot = slotsById.get(occurrence.classScheduleSlotId)
    if (!slot) return []
    return [
      {
        slotId: slot.id,
        classPeriodId: slot.classPeriodId,
        className: slot.classPeriod.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
        teachers: slot.teachers.map(({ teacher }) =>
          `${teacher.firstName} ${teacher.lastName}`.trim()
        ),
        attendance: attendanceEnabled ? occurrence.status : null,
      },
    ]
  })

  return {
    closed,
    classes,
    attendanceToTake: attendanceEnabled
      ? classes.filter((item) => item.attendance !== 'VALIDATED').length
      : 0,
  }
}
