import { beforeEach, describe, expect, it } from 'vitest'
import { Profile } from '@/domain/profile'
import type { ProfileGateway } from '@/gateways/profile-gateway'
import { getProfile } from './get-profile'

class ProfileGatewaySpy implements ProfileGateway {
  profileToReturn: Profile | null = null

  async findByUserId() {
    return this.profileToReturn
  }

  async save() {
    return undefined
  }

  async delete() {
    return undefined
  }
}

function createProfile(
  overrides?: Partial<{ userId: string; name: string; bio: string | null }>
): Profile {
  const result = Profile.create({
    userId: overrides?.userId ?? 'user-123',
    name: overrides?.name ?? 'John Doe',
    bio: overrides?.bio ?? null,
  })
  if (typeof result === 'string') {
    throw new Error(`Profile creation failed: ${result}`)
  }
  return result
}

describe('getProfile', () => {
  let gateway: ProfileGatewaySpy

  beforeEach(() => {
    gateway = new ProfileGatewaySpy()
  })

  describe('given the profile does not exist', () => {
    it('returns profileNotFound', async () => {
      // GIVEN
      gateway.profileToReturn = null

      // WHEN
      const result = await getProfile('user-123', gateway)

      // THEN
      expect(result).toBe('profileNotFound')
    })
  })

  describe('given the profile exists', () => {
    beforeEach(() => {
      gateway.profileToReturn = createProfile()
    })

    it('returns the profile state', async () => {
      // GIVEN
      const userId = 'user-456'

      // WHEN
      const result = await getProfile(userId, gateway)

      // THEN
      expect(result).not.toBe('profileNotFound')
      expect(result).toHaveProperty('userId')
      expect(result).toHaveProperty('name')
    })

    it('returns profile with correct user id', async () => {
      // GIVEN
      gateway.profileToReturn = createProfile({ userId: 'user-789' })

      // WHEN
      const result = await getProfile('user-789', gateway)

      // THEN
      if (result !== 'profileNotFound') {
        expect(result.userId).toBe('user-789')
      }
    })

    it('returns profile with name', async () => {
      // GIVEN
      gateway.profileToReturn = createProfile({ name: 'Jane Smith' })

      // WHEN
      const result = await getProfile('user-456', gateway)

      // THEN
      if (result !== 'profileNotFound') {
        expect(result.name).toBe('Jane Smith')
      }
    })

    it('returns profile with bio when set', async () => {
      // GIVEN
      gateway.profileToReturn = createProfile({ bio: 'Software engineer' })

      // WHEN
      const result = await getProfile('user-456', gateway)

      // THEN
      if (result !== 'profileNotFound') {
        expect(result.bio).toBe('Software engineer')
      }
    })

    it('returns profile with null bio when not set', async () => {
      // GIVEN
      gateway.profileToReturn = createProfile({ bio: null })

      // WHEN
      const result = await getProfile('user-456', gateway)

      // THEN
      if (result !== 'profileNotFound') {
        expect(result.bio).toBeNull()
      }
    })

    it('returns profile state with timestamps', async () => {
      // GIVEN
      const createdAt = new Date('2026-01-01')
      const result = Profile.create({
        userId: 'user-456',
        name: 'Test User',
        createdAt,
        updatedAt: createdAt,
      })
      if (typeof result === 'string') throw new Error('Profile creation failed')
      gateway.profileToReturn = result

      // WHEN
      const profileState = await getProfile('user-456', gateway)

      // THEN
      if (profileState !== 'profileNotFound') {
        expect(profileState).toHaveProperty('createdAt')
        expect(profileState).toHaveProperty('updatedAt')
      }
    })
  })
})
