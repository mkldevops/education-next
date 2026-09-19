import type { z } from 'zod'
import { MAX_EVENT_IMAGES } from '@/domain/event'
import { configGateway } from '@/gateways/config-gateway'
import { eventGateway } from '@/gateways/event-gateway'
import { readEventsEnabled } from './is-events-enabled'
import { addEventImageSchema } from './schemas'

type Input = z.infer<typeof addEventImageSchema>

export async function addEventImage(input: Input, gw = eventGateway, configGw = configGateway) {
  const parsed = addEventImageSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, eventId, storageKey, alt } = parsed.data
  if (!(await readEventsEnabled(schoolId, configGw))) return 'notConfigured' as const

  const event = await gw.findById(schoolId, eventId)
  if (!event) return 'notFound' as const

  const count = await gw.countImages(schoolId, eventId)
  if (count >= MAX_EVENT_IMAGES) return 'tooManyImages' as const

  return gw.addImage(schoolId, { eventId, storageKey, alt, position: count })
}
