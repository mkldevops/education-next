import type { z } from 'zod'
import { isAttendanceClosed } from '@/domain/attendance-closure'
import { expectedAttendance } from '@/domain/attendance-tracking'
import { DAY_MS } from '@/domain/day'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { MCP_ATTENDANCE_RANGE_MAX_DAYS, mcpListAttendanceCallsSchema } from './schemas'

type Input = z.infer<typeof mcpListAttendanceCallsSchema>

type CallStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'VALIDATED' | 'CANCELLED'

type Call = {
  classPeriod: { id: string; name: string }
  slotId: string | null
  startTime: string | null
  endTime: string | null
  status: CallStatus
  sessionId: string | null
  validatedAt: Date | null
}

const SESSION_STATUS = {
  DRAFT: 'IN_PROGRESS',
  VALIDATED: 'VALIDATED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<string, CallStatus>

const ADHOC = 'adhoc'

function utcDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

/**
 * Relecture du suivi des appels, jour par jour, telle que `/dashboard/attendance` l'affiche :
 * créneaux attendus (non commencés, en cours, validés), appels exceptionnels et appels
 * annulés. Un jour de fermeture ne garde que les appels déjà ouverts. Aucun élève ni
 * présence : la saisie et la validation restent dans le tableau de bord.
 */
export async function listAttendanceCallsFromMcp(
  scope: { schoolId: string },
  input: Input,
  readGw = mcpReadGateway,
  configGw = configGateway
) {
  const parsed = mcpListAttendanceCallsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { periodId, classPeriodId } = parsed.data
  const from = utcDay(parsed.data.from)
  const to = utcDay(parsed.data.to ?? parsed.data.from)
  const dayCount = (to.getTime() - from.getTime()) / DAY_MS + 1
  if (dayCount < 1) return 'invalidDateRange' as const
  if (dayCount > MCP_ATTENDANCE_RANGE_MAX_DAYS) return 'rangeTooLong' as const

  const config = await configGw.get(scope.schoolId, ATTENDANCE_ENABLED_CONFIG_KEY)
  if (!readsAsOptedIn(config?.value)) return 'notConfigured' as const
  if (!(await readGw.findPeriod(scope.schoolId, periodId))) return 'notFound' as const

  const before = new Date(to.getTime() + DAY_MS)
  const filter = { periodId, classPeriodId, from, before }
  const [slots, sessions, closures] = await Promise.all([
    readGw.listAttendanceSlots(scope.schoolId, filter),
    readGw.listAttendanceSessions(scope.schoolId, filter),
    readGw.listAttendanceClosures(scope.schoolId, from, before),
  ])

  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(from.getTime() + index * DAY_MS)
    const daySessions = sessions.filter(
      (session) => session.occurredOn.getTime() === date.getTime()
    )
    const closed = isAttendanceClosed(closures, date)
    const daySlots = closed
      ? slots.filter((slot) =>
          daySessions.some(
            (session) =>
              session.classPeriodId === slot.classPeriodId && session.occurrenceKey === slot.id
          )
        )
      : slots

    const slotById = new Map(daySlots.map((slot) => [slot.id, slot]))
    const scheduled = expectedAttendance(date, daySlots, daySessions).flatMap<Call>((item) => {
      const slot = slotById.get(item.classScheduleSlotId)
      if (!slot) return []
      const session = daySessions.find(
        (candidate) =>
          candidate.classPeriodId === item.classPeriodId && candidate.occurrenceKey === slot.id
      )
      return [
        {
          classPeriod: slot.classPeriod,
          slotId: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: item.status,
          sessionId: session?.id ?? null,
          validatedAt: session?.validatedAt ?? null,
        },
      ]
    })

    const others = daySessions
      .filter(
        (session) =>
          session.occurrenceKey === ADHOC ||
          (session.status === 'CANCELLED' &&
            slots.some((slot) => slot.id === session.occurrenceKey))
      )
      .map<Call>((session) => {
        const slot = slots.find((candidate) => candidate.id === session.occurrenceKey)
        return {
          classPeriod: session.classPeriod,
          slotId: slot?.id ?? null,
          startTime: slot?.startTime ?? null,
          endTime: slot?.endTime ?? null,
          status: SESSION_STATUS[session.status],
          sessionId: session.id,
          validatedAt: session.validatedAt,
        }
      })

    return { date: date.toISOString().slice(0, 10), closed, calls: [...scheduled, ...others] }
  })

  return { days: days.filter((day) => day.closed || day.calls.length > 0) }
}
