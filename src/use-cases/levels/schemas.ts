import { z } from 'zod'

export const createLevelSchema = z.object({
  name: z.string().min(1).max(250),
})

export const setNextLevelSchema = z.object({
  id: z.string().uuid(),
  nextLevelId: z.string().uuid().nullable(),
})
