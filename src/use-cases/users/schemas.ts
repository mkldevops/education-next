import { z } from 'zod'

export const userIdSchema = z.object({ id: z.cuid() })

export const updateUserSchema = z.object({
  id: z.cuid(),
  name: z.string().min(1).max(250).nullish(),
  email: z.email().max(250).optional(),
  emailVerified: z.boolean().optional(),
})

export const changeUserRoleSchema = z.object({
  id: z.cuid(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'PARENT']),
})

export const userFamilySchema = z.object({
  id: z.cuid(),
  familyId: z.uuid(),
})
