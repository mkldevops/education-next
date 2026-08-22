import { z } from 'zod'

export const createLevelSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(250),
})

export const setNextLevelSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  nextLevelId: z.string().uuid().nullable(),
})

export const renameLevelSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(250),
})

export const deactivateLevelSchema = z.object({
  schoolId: z.string().min(1),
  id: z.string().uuid(),
})
