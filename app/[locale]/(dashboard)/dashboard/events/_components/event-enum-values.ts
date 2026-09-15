import type { EventCategory, EventStatus, EventVisibility } from '@/generated/prisma/client'

// `EventCategory`/`EventVisibility`/`EventStatus` sont des unions TypeScript sans
// représentation runtime : ces tableaux sont la seule source pour peupler un `<select>`,
// partagée par la page et les deux dialogues plutôt que redéclarée à chaque appelant.
export const EVENT_CATEGORY_VALUES: EventCategory[] = [
  'MEETING',
  'TERM_START',
  'OUTING',
  'HOLIDAY',
  'CLOSURE',
  'CELEBRATION',
  'OTHER',
]

export const EVENT_VISIBILITY_VALUES: EventVisibility[] = ['PUBLIC', 'MEMBERS', 'STAFF']

export const EVENT_STATUS_VALUES: EventStatus[] = ['DRAFT', 'PUBLISHED', 'CANCELLED']
