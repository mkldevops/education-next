import { DAY_MS, utcStartOfDay } from '@/domain/day'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { roundHalfUp } from '@/lib/decimal'
import { isPaymentsEnabled } from '@/use-cases/config/is-payments-enabled'
import { getOverdueStudents } from '@/use-cases/payments/overdue-students'

/**
 * Ce qui attend l'administrateur à l'ouverture de l'assistant. `null` : module fermé, ou
 * lecture en échec ; la carte correspondante disparaît sans emporter la page.
 */
export type AssistantBriefing = {
  overdue: { families: number; amount: number } | null
  openCalls: { count: number; classes: string[] } | null
  pendingEnrollments: number | null
}

async function readOverdue(schoolId: string, overdueStudents: typeof getOverdueStudents) {
  if (!(await isPaymentsEnabled(schoolId))) return null
  const students = await overdueStudents(schoolId)
  const families = new Map(students.map((student) => [student.family.id, student.family]))
  return {
    families: families.size,
    amount: roundHalfUp(
      [...families.values()].reduce((sum, family) => sum + family.overdueAmount, 0)
    ),
  }
}

async function readOpenCalls(schoolId: string, now: Date) {
  const config = await configGateway.get(schoolId, ATTENDANCE_ENABLED_CONFIG_KEY)
  if (!readsAsOptedIn(config?.value)) return null
  const today = utcStartOfDay(now)
  const sessions = await db.attendanceSession.findMany({
    where: {
      schoolId,
      status: 'DRAFT',
      occurredOn: { gte: today, lt: new Date(today.getTime() + DAY_MS) },
    },
    select: { classPeriod: { select: { name: true } } },
    orderBy: { classPeriod: { name: 'asc' } },
  })
  return {
    count: sessions.length,
    classes: [...new Set(sessions.map(({ classPeriod }) => classPeriod.name))],
  }
}

function readPendingEnrollments(schoolId: string) {
  return db.enrollment.count({ where: { schoolId, status: 'PENDING' } })
}

const settled = <T>(result: PromiseSettledResult<T>) => {
  if (result.status === 'fulfilled') return result.value
  console.error('[assistant-briefing]', result.reason)
  return null
}

export async function getAssistantBriefing(
  schoolId: string,
  now = new Date(),
  overdueStudents = getOverdueStudents
): Promise<AssistantBriefing> {
  const [overdue, openCalls, pendingEnrollments] = await Promise.allSettled([
    readOverdue(schoolId, overdueStudents),
    readOpenCalls(schoolId, now),
    readPendingEnrollments(schoolId),
  ])
  return {
    overdue: settled(overdue),
    openCalls: settled(openCalls),
    pendingEnrollments: settled(pendingEnrollments),
  }
}
