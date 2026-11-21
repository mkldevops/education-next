import type { z } from 'zod'
import { readsAsOptedIn } from '@/domain/feature-flags'
import { configGateway } from '@/gateways/config-gateway'
import { ATTENDANCE_ENABLED_CONFIG_KEY } from '@/lib/attendance-config'
import { db } from '@/lib/db'
import { refreshSessionRoster } from '@/use-cases/attendance/attendance-roster'
import { mcpRefreshAttendanceRosterSchema } from './schemas'

type Input = z.input<typeof mcpRefreshAttendanceRosterSchema>

const defaultDeps = {
  readConfig: configGateway.get,
  refresh: (input: Parameters<typeof refreshSessionRoster>[1]) =>
    db.$transaction((tx) => refreshSessionRoster(tx, input)),
}

/**
 * `refresh_attendance_roster` : le bouton « Actualiser la liste des élèves » de l'appel, pour un
 * appel en cours (`DRAFT`) désigné par le `sessionId` de `list_attendance_calls`. Les élèves
 * ajoutés arrivent non saisis : l'enseignant les voit à l'écran avant de valider, un appel validé
 * depuis un écran plus ancien ne les compte pas présents à son insu.
 */
export async function refreshAttendanceRosterFromMcp(
  scope: { schoolId: string; userId: string },
  input: Input,
  deps = defaultDeps
) {
  const parsed = mcpRefreshAttendanceRosterSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const
  const config = await deps.readConfig(scope.schoolId, ATTENDANCE_ENABLED_CONFIG_KEY)
  if (!readsAsOptedIn(config?.value)) return 'notConfigured' as const
  const result = await deps.refresh({
    schoolId: scope.schoolId,
    sessionId: parsed.data.sessionId,
    actorId: scope.userId,
    status: 'NOT_RECORDED',
  })
  if (typeof result === 'string') return result
  return { sessionId: parsed.data.sessionId, added: result.added }
}
