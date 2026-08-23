import { describe, expect, it } from 'vitest'
import {
  changePlatformLevelSchema,
  updateUserSchema,
  userFamilySchema,
  userIdSchema,
} from '../schemas'

/**
 * `User.id` est produit par Better Auth, pas par Prisma : le `@default(cuid())` du
 * schéma ne s'applique jamais. Les identifiants réels sont 32 caractères
 * alphanumériques, qu'un `z.cuid()` rejette tous — la gestion de comptes entière
 * répondait `validationError` sur chaque appel. Ces identifiants sont lus en base.
 */
const REAL_IDS = [
  'IQIcCmrvISuDG9mVxlPh4ISuCj7bdZxw',
  'lrbXitmZ1rO0eNSSElignkCbT8tqmzuC',
  '5Z7O4dJVfXDz7WgEF2p6jeC2cArrOTSy',
]

const FAMILY_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('user schemas', () => {
  it.each(REAL_IDS)('accepts the Better Auth id %s', (id) => {
    expect(userIdSchema.safeParse({ id }).success).toBe(true)
    expect(updateUserSchema.safeParse({ id }).success).toBe(true)
    expect(changePlatformLevelSchema.safeParse({ id, isSuperAdmin: true }).success).toBe(true)
    expect(userFamilySchema.safeParse({ id, familyId: FAMILY_ID }).success).toBe(true)
  })

  it('still rejects an empty id', () => {
    expect(userIdSchema.safeParse({ id: '' }).success).toBe(false)
    expect(changePlatformLevelSchema.safeParse({ id: '', isSuperAdmin: true }).success).toBe(false)
  })

  /** `Family` est un modèle métier : Prisma génère son id, donc `uuid` reste juste. */
  it('keeps familyId a uuid', () => {
    expect(userFamilySchema.safeParse({ id: REAL_IDS[0], familyId: 'not-a-uuid' }).success).toBe(
      false
    )
  })
})
