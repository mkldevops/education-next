import { z } from 'zod'

/**
 * `User.id` est produit par Better Auth, pas par Prisma : le `@default(cuid())` du
 * schéma ne s'applique jamais, et les identifiants réels sont 32 caractères
 * alphanumériques qu'un `z.cuid()` rejette tous. Même convention que
 * `invitationIdSchema` — `Invitation.id` vient de la même source.
 *
 * `familyId` reste un `uuid` : `Family` est un modèle métier, dont Prisma génère l'id.
 */
const userId = z.string().min(1)

export const userIdSchema = z.object({ id: userId })

export const updateUserSchema = z.object({
  id: userId,
  name: z.string().min(1).max(250).nullish(),
  email: z.email().max(250).optional(),
  emailVerified: z.boolean().optional(),
})

export const changePlatformLevelSchema = z.object({
  id: userId,
  isSuperAdmin: z.boolean(),
})

export const userFamilySchema = z.object({
  id: userId,
  familyId: z.uuid(),
})
