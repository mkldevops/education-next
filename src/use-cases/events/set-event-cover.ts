import type { z } from 'zod'
import { reorderImagesForCover } from '@/domain/event'
import { configGateway } from '@/gateways/config-gateway'
import { eventGateway } from '@/gateways/event-gateway'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { setEventCoverSchema } from './schemas'

type Input = z.infer<typeof setEventCoverSchema>

export async function setEventCover(input: Input, gw = eventGateway, configGw = configGateway) {
  const parsed = setEventCoverSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, eventId, imageId } = parsed.data
  const config = await configGw.get(schoolId, EVENTS_CONFIG_KEY)
  if (config?.value !== 'true') return 'notConfigured' as const

  const event = await gw.findById(schoolId, eventId)
  if (!event) return 'notFound' as const

  const ordered = reorderImagesForCover(event.images, imageId)
  if (!ordered) return 'notFound' as const

  const images = await gw.reorderImages(
    schoolId,
    eventId,
    ordered.map((image) => image.id)
  )
  return images
}
