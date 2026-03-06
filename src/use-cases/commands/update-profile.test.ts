import { beforeEach, describe, expect, it } from 'vitest'
import { Profile } from '@/domain/profile'
import type { ProfileGateway } from '@/gateways/profile-gateway'
import { type UpdateProfileData, updateProfile } from './update-profile'

class ProfileGatewaySpy implements ProfileGateway {
  profileToReturn: Profile | null = null
  spiedUserId: string | null = null
  savedProfile: Profile | null = null
  deletedUserId: string | null = null

  async findByUserId(userId: string): Promise<Profile | null> {
    this.spiedUserId = userId
    return this.profileToReturn
  }

  async save(profile: Profile): Promise<void> {
    this.savedProfile = profile
  }

  async delete(userId: string): Promise<void> {
    this.deletedUserId = userId
  }
}

function createProfile(
  overrides?: Partial<{ userId: string; name: string; bio: string | null; image: string | null }>
): Profile {
  const result = Profile.create({
    userId: overrides?.userId ?? 'user-123',
    name: overrides?.name ?? 'John Doe',
    bio: overrides?.bio ?? null,
    image: overrides?.image ?? null,
  })
  if (typeof result === 'string') {
    throw new Error(`Profile creation failed: ${result}`)
  }
  return result
}

describe('updateProfile', () => {
  let gateway: ProfileGatewaySpy

  beforeEach(() => {
    gateway = new ProfileGatewaySpy()
  })

  describe('given the profile does not exist', () => {
    it('fails because the profile is not found', async () => {
      // GIVEN
      gateway.profileToReturn = null

      // WHEN
      const result = await updateProfile('user-123', { name: 'New Name' }, gateway)

      // THEN
      expect(result).toBe('profileNotFound')
    })

    it('does not save anything', async () => {
      // GIVEN
      gateway.profileToReturn = null

      // WHEN
      await updateProfile('user-123', { name: 'New Name' }, gateway)

      // THEN
      expect(gateway.savedProfile).toBeNull()
    })
  })

  describe('given the profile exists', () => {
    beforeEach(() => {
      gateway.profileToReturn = createProfile()
    })

    it("retrieves the user's profile", async () => {
      // GIVEN
      const userId = 'user-456'

      // WHEN
      await updateProfile(userId, { name: 'New Name' }, gateway)

      // THEN
      expect(gateway.spiedUserId).toBe('user-456')
    })

    describe('when updating the name', () => {
      it('succeeds when name is valid', async () => {
        // GIVEN
        const data = { name: 'New Name' }

        // WHEN
        const result = await updateProfile('user-123', data, gateway)

        // THEN
        expect(result).toBe('OK')
      })

      it('saves the profile with the updated name', async () => {
        // GIVEN
        const data = { name: 'New Name' }

        // WHEN
        await updateProfile('user-123', data, gateway)

        // THEN
        expect(gateway.savedProfile?.name).toBe('New Name')
      })

      it('fails when name is empty', async () => {
        // GIVEN
        const data = { name: '' }

        // WHEN
        const result = await updateProfile('user-123', data, gateway)

        // THEN
        expect(result).toBe('nameRequired')
      })

      it('fails when name contains only spaces', async () => {
        // GIVEN
        const data = { name: '   ' }

        // WHEN
        const result = await updateProfile('user-123', data, gateway)

        // THEN
        expect(result).toBe('nameRequired')
      })

      it('does not save when name is invalid', async () => {
        // GIVEN
        const data = { name: '' }

        // WHEN
        await updateProfile('user-123', data, gateway)

        // THEN
        expect(gateway.savedProfile).toBeNull()
      })
    })

    describe('when updating the bio', () => {
      it('saves the profile with the new bio', async () => {
        // GIVEN
        const data = { bio: 'New bio' }

        // WHEN
        await updateProfile('user-123', data, gateway)

        // THEN
        expect(gateway.savedProfile?.bio).toBe('New bio')
      })

      it('allows removing the bio', async () => {
        // GIVEN
        gateway.profileToReturn = createProfile({ bio: 'Existing bio' })
        const data = { bio: null }

        // WHEN
        await updateProfile('user-123', data, gateway)

        // THEN
        expect(gateway.savedProfile?.bio).toBeNull()
      })
    })

    describe('when updating the image', () => {
      it('saves the profile with the new image', async () => {
        // GIVEN
        const data = { image: 'https://example.com/avatar.jpg' }

        // WHEN
        await updateProfile('user-123', data, gateway)

        // THEN
        expect(gateway.savedProfile?.image).toBe('https://example.com/avatar.jpg')
      })

      it('allows removing the image', async () => {
        // GIVEN
        gateway.profileToReturn = createProfile({ image: 'https://example.com/old.jpg' })
        const data = { image: null }

        // WHEN
        await updateProfile('user-123', data, gateway)

        // THEN
        expect(gateway.savedProfile?.image).toBeNull()
      })
    })

    describe('when updating multiple fields', () => {
      it('saves the profile with all updated fields', async () => {
        // GIVEN
        const data: UpdateProfileData = {
          name: 'Jane Doe',
          bio: 'Software developer',
          image: 'https://example.com/jane.jpg',
        }

        // WHEN
        await updateProfile('user-123', data, gateway)

        // THEN
        expect(gateway.savedProfile?.name).toBe('Jane Doe')
        expect(gateway.savedProfile?.bio).toBe('Software developer')
        expect(gateway.savedProfile?.image).toBe('https://example.com/jane.jpg')
      })
    })

    describe('when no fields are updated', () => {
      it('succeeds without error', async () => {
        // GIVEN
        const data = {}

        // WHEN
        const result = await updateProfile('user-123', data, gateway)

        // THEN
        expect(result).toBe('OK')
      })

      it('still saves the profile', async () => {
        // GIVEN
        const data = {}

        // WHEN
        await updateProfile('user-123', data, gateway)

        // THEN
        expect(gateway.savedProfile).not.toBeNull()
      })
    })
  })
})
