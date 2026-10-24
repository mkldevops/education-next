import { z } from 'zod'

export const createLevelSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().min(1).max(250),
})

export const setNextLevelsSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
  nextLevelIds: z.array(z.uuid()).max(50),
})

export const renameLevelSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
  name: z.string().min(1).max(250),
})

export const deactivateLevelSchema = z.object({
  schoolId: z.string().min(1),
  id: z.uuid(),
})
