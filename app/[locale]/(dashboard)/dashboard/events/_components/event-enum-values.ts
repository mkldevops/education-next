import { EventCategory, EventStatus, EventVisibility } from '@/generated/prisma/enums'

// Ces tableaux alimentent les options des `<select>` de la page et des deux dialogues.
export const EVENT_CATEGORY_VALUES: EventCategory[] = Object.values(EventCategory)

export const EVENT_VISIBILITY_VALUES: EventVisibility[] = Object.values(EventVisibility)

export const EVENT_STATUS_VALUES: EventStatus[] = Object.values(EventStatus)

export function isEventCategory(value: string | undefined): value is EventCategory {
  return value !== undefined && (EVENT_CATEGORY_VALUES as readonly string[]).includes(value)
}
