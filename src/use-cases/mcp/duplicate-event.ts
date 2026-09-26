import type { z } from 'zod'
import { duplicateEvent } from '@/use-cases/events/duplicate-event'
import { publishEvent } from './event-fields'
import { mcpDuplicateEventSchema } from './schemas'

type Input = z.infer<typeof mcpDuplicateEventSchema>

/** Adaptateur MCP de `duplicateEvent` : le double naît brouillon, un an plus tard. */
export async function duplicateEventFromMcp(
  scope: { schoolId: string },
  input: Input,
  duplicate = duplicateEvent
) {
  const parsed = mcpDuplicateEventSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const result = await duplicate({ ...parsed.data, schoolId: scope.schoolId })
  if (typeof result === 'string') return result

  return publishEvent(result)
}
