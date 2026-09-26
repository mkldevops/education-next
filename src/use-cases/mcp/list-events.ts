import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { mcpReadGateway } from '@/gateways/mcp-read-gateway'
import { readEventsEnabled } from '@/use-cases/events/is-events-enabled'
import { toWallClock } from './event-fields'
import { MCP_EVENT_LIST_DEFAULT, mcpListEventsSchema } from './schemas'

type Input = z.infer<typeof mcpListEventsSchema>

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Liste bornée des événements actifs de l'école, tous statuts confondus : c'est la
 * relecture d'un brouillon dicté plus tôt qui la justifie. `to` est un jour inclus, et la
 * ligne de trop lue au-delà de `limit` ne sert qu'à dire `hasMore`.
 */
export async function listEventsFromMcp(
  scope: { schoolId: string },
  input: Input,
  readGw = mcpReadGateway,
  configGw = configGateway
) {
  const parsed = mcpListEventsSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { from, to, status, limit = MCP_EVENT_LIST_DEFAULT } = parsed.data
  if (from && to && to < from) return 'invalidDateRange' as const
  if (!(await readEventsEnabled(scope.schoolId, configGw))) return 'notConfigured' as const

  const rows = await readGw.listEvents(scope.schoolId, {
    from: from ? toWallClock(from) : undefined,
    before: to ? new Date(toWallClock(to).getTime() + DAY_MS) : undefined,
    status,
    take: limit + 1,
  })

  return { events: rows.slice(0, limit), hasMore: rows.length > limit }
}
