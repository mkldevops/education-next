import type { z } from 'zod'
import { reorderImagesForCover } from '@/domain/event'
import { configGateway } from '@/gateways/config-gateway'
import { eventGateway } from '@/gateways/event-gateway'
import { readEventsEnabled } from './is-events-enabled'
import { setEventCoverSchema } from './schemas'

type Input = z.infer<typeof setEventCoverSchema>

export async function setEventCover(input: Input, gw = eventGateway, configGw = configGateway) {
  const parsed = setEventCoverSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, eventId, imageId } = parsed.data
  if (!(await readEventsEnabled(schoolId, configGw))) return 'notConfigured' as const

  const event = await gw.findById(schoolId, eventId)
  if (!event) return 'notFound' as const

  const ordered = reorderImagesForCover(event.images, imageId)
  if (!ordered) return 'notFound' as const

  return gw.reorderImages(
    schoolId,
    eventId,
    ordered.map((image) => image.id)
  )
}
