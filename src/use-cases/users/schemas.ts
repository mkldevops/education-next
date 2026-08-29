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
  /**
   * `User.email` n'est écrit qu'en minuscules : l'index unique de Postgres est sensible
   * à la casse, et deux comptes ne différant que par la casse s'y logeraient sans que le
   * garde d'unicité de `updateUser` les voie.
   */
  email: z.email().max(250).toLowerCase().optional(),
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
