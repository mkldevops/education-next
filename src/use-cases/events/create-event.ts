import type { z } from 'zod'
import { normalizeEventDates, slugifyEventTitle, validateEventRange } from '@/domain/event'
import { configGateway } from '@/gateways/config-gateway'
import { eventGateway } from '@/gateways/event-gateway'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { createEventSchema } from './schemas'

type Input = z.infer<typeof createEventSchema>

export async function createEvent(input: Input, gw = eventGateway, configGw = configGateway) {
  const parsed = createEventSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, ...data } = parsed.data
  const config = await configGw.get(schoolId, EVENTS_CONFIG_KEY)
  if (config?.value !== 'true') return 'notConfigured' as const

  const normalized = normalizeEventDates({ ...data, allDay: data.allDay ?? true })

  const rangeCheck = validateEventRange(normalized)
  if (rangeCheck !== 'OK') return rangeCheck

  const slug = slugifyEventTitle(normalized.title)
  const existing = await gw.findBySlug(schoolId, slug)
  if (existing) return 'slugTaken' as const

  return gw.create(schoolId, { ...normalized, slug })
}
