import type { z } from 'zod'
import { updateEvent } from '@/use-cases/events/update-event'
import { isDateOnly, publishEvent, toWallClock } from './event-fields'
import { mcpUpdateEventSchema } from './schemas'

type Input = z.infer<typeof mcpUpdateEventSchema>

/**
 * Adaptateur MCP de `updateEvent`, limité aux brouillons (`'notDraft'` sinon) : drapeau,
 * bornes de dates et refus `'slugTaken'` restent ceux du tableau de bord.
 *
 * Comme à la création, un `startAt` sans `allDay` tranche par sa forme ; sans `startAt`,
 * l'événement garde son `allDay`.
 */
export async function updateEventFromMcp(
  scope: { schoolId: string },
  input: Input,
  update = updateEvent
) {
  const parsed = mcpUpdateEventSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { startAt, endAt, allDay, ...data } = parsed.data
  const result = await update(
    {
      ...data,
      schoolId: scope.schoolId,
      ...(allDay !== undefined || startAt !== undefined
        ? { allDay: allDay ?? isDateOnly(startAt as string) }
        : {}),
      ...(startAt !== undefined ? { startAt: toWallClock(startAt) } : {}),
      ...(endAt !== undefined ? { endAt: endAt === null ? null : toWallClock(endAt) } : {}),
    },
    undefined,
    undefined,
    { draftOnly: true }
  )
  if (typeof result === 'string') return result

  return publishEvent(result)
}
