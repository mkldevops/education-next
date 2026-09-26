import type { z } from 'zod'
import { createEvent } from '@/use-cases/events/create-event'
import { isDateOnly, publishEvent, toWallClock } from './event-fields'
import type { McpScope } from './resolve-mcp-scope'
import { mcpCreateEventSchema } from './schemas'

type Input = z.infer<typeof mcpCreateEventSchema>

/**
 * Adaptateur MCP de `createEvent`, qui garde seul drapeau, bornes et refus `'slugTaken'` :
 * ce fichier ne fait que traduire des chaînes ISO en `Date` et fixer l'école de la clé.
 *
 * Sans `allDay` explicite, la forme de `startAt` tranche : un jour seul est une journée
 * entière, une heure ne l'est pas. Le défaut de `createEvent` (`true`) ramènerait sinon
 * une réunion dictée à 18 h à minuit.
 */
export async function createEventFromMcp(
  scope: Pick<McpScope, 'schoolId'>,
  input: Input,
  create = createEvent
) {
  const parsed = mcpCreateEventSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { startAt, endAt, allDay, ...data } = parsed.data
  const result = await create({
    ...data,
    schoolId: scope.schoolId,
    allDay: allDay ?? isDateOnly(startAt),
    startAt: toWallClock(startAt),
    endAt: endAt ? toWallClock(endAt) : null,
  })
  if (typeof result === 'string') return result

  return publishEvent(result)
}
