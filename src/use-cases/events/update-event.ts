import type { z } from 'zod'
import { normalizeEventDates, slugifyEventTitle, validateEventRange } from '@/domain/event'
import { configGateway } from '@/gateways/config-gateway'
import { eventGateway } from '@/gateways/event-gateway'
import { EVENTS_CONFIG_KEY } from '@/lib/events-config'
import { updateEventSchema } from './schemas'

type Input = z.infer<typeof updateEventSchema>

export async function updateEvent(input: Input, gw = eventGateway, configGw = configGateway) {
  const parsed = updateEventSchema.safeParse(input)
  if (!parsed.success) return 'validationError' as const

  const { schoolId, id, ...data } = parsed.data
  const config = await configGw.get(schoolId, EVENTS_CONFIG_KEY)
  if (config?.value !== 'true') return 'notConfigured' as const

  const event = await gw.findById(schoolId, id)
  if (!event) return 'notFound' as const

  const normalized = normalizeEventDates({
    allDay: data.allDay ?? event.allDay,
    startAt: data.startAt ?? event.startAt,
    endAt: data.endAt === undefined ? event.endAt : data.endAt,
  })

  const rangeCheck = validateEventRange(normalized)
  if (rangeCheck !== 'OK') return rangeCheck

  // Un suffixe automatique casserait silencieusement une URL déjà partagée : on ne
  // recalcule le slug que si le titre change, et on ne le heurte pas contre lui-même
  // quand le nouveau titre se réduit au slug déjà en place.
  let slug: string | undefined
  if (data.title !== undefined && data.title !== event.title) {
    const candidate = slugifyEventTitle(data.title)
    if (candidate !== event.slug) {
      const existing = await gw.findBySlug(schoolId, candidate)
      if (existing && existing.id !== id) return 'slugTaken' as const
      slug = candidate
    }
  }

  return gw.update(schoolId, id, {
    ...data,
    ...normalized,
    ...(slug !== undefined ? { slug } : {}),
  })
}
