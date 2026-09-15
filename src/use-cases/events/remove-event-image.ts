import type { z } from 'zod'
import { configGateway } from '@/gateways/config-gateway'
import { eventGateway } from '@/gateways/event-gateway'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { removeEventImageSchema } from './schemas'

type Input = z.infer<typeof removeEventImageSchema>

export async function removeEventImage(input: Input, gw = eventGateway, configGw = configGateway) {
  const parsed = removeEventImageSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, eventId, imageId } = parsed.data
  const config = await configGw.get(schoolId, EVENTS_CONFIG_KEY)
  if (config?.value !== 'true') return 'notConfigured' as const

  const event = await gw.findById(schoolId, eventId)
  if (!event) return 'notFound' as const

  const belongsToEvent = event.images.some((image) => image.id === imageId)
  if (!belongsToEvent) return 'notFound' as const

  return gw.removeImage(schoolId, eventId, imageId)
}
