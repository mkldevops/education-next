import { z } from 'zod'

export const EVENT_CATEGORIES = [
  'MEETING',
  'TERM_START',
  'OUTING',
  'HOLIDAY',
  'CLOSURE',
  'CELEBRATION',
  'OTHER',
] as const

export const EVENT_VISIBILITIES = ['PUBLIC', 'MEMBERS', 'STAFF'] as const

export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CANCELLED'] as const

export const createEventSchema = z.object({
  schoolId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(280).nullish(),
  description: z.string().trim().max(5000).nullish(),
  category: z.enum(EVENT_CATEGORIES),
  visibility: z.enum(EVENT_VISIBILITIES).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  allDay: z.boolean().optional(),
  startAt: z.date(),
  endAt: z.date().nullish(),
  location: z.string().trim().max(250).nullish(),
  announceDaysBefore: z.number().int().nonnegative().nullish(),
})

export const updateEventSchema = createEventSchema
  .extend({ id: z.uuid() })
  .partial({ title: true, category: true, startAt: true })
  .required({ schoolId: true, id: true })

export const addEventImageSchema = z.object({
  schoolId: z.string().min(1),
  eventId: z.uuid(),
  storageKey: z.string().min(1).max(250),
  alt: z.string().trim().max(250).nullish(),
})

export const removeEventImageSchema = z.object({
  schoolId: z.string().min(1),
  eventId: z.uuid(),
  imageId: z.uuid(),
})

export const setEventCoverSchema = z.object({
  schoolId: z.string().min(1),
  eventId: z.uuid(),
  imageId: z.uuid(),
})
