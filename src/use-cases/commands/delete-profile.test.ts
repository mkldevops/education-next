import { beforeEach, describe, expect, it } from 'vitest'
import { Profile } from '@/domain/profile'
import type { ProfileGateway } from '@/gateways/profile-gateway'
import { deleteProfile } from './delete-profile'

class ProfileGatewaySpy implements ProfileGateway {
  profileToReturn: Profile | null = null
  deletedUserId: string | null = null

  async findByUserId() {
    return this.profileToReturn
  }

  async save() {
    return undefined
  }

  async delete(userId: string) {
    this.deletedUserId = userId
  }
}

function createProfile(overrides?: Partial<{ userId: string; name: string }>): Profile {
  const result = Profile.create({
    userId: overrides?.userId ?? 'user-123',
    name: overrides?.name ?? 'John Doe',
  })
  if (typeof result === 'string') {
    throw new Error(`Profile creation failed: ${result}`)
  }
  return result
}

describe('deleteProfile', () => {
  let gateway: ProfileGatewaySpy

  beforeEach(() => {
    gateway = new ProfileGatewaySpy()
  })

  describe('given the profile does not exist', () => {
    it('fails because the profile is not found', async () => {
      // GIVEN
      gateway.profileToReturn = null

      // WHEN
      const result = await deleteProfile('user-123', gateway)

      // THEN
      expect(result).toBe('profileNotFound')
    })

    it('does not call delete on gateway', async () => {
      // GIVEN
      gateway.profileToReturn = null

      // WHEN
      await deleteProfile('user-123', gateway)

      // THEN
      expect(gateway.deletedUserId).toBeNull()
    })
  })

  describe('given the profile exists', () => {
    beforeEach(() => {
      gateway.profileToReturn = createProfile()
    })

    it('deletes the profile successfully', async () => {
      // GIVEN
      const userId = 'user-456'

      // WHEN
      const result = await deleteProfile(userId, gateway)

      // THEN
      expect(result).toBe('OK')
    })

    it('calls delete with the correct user id', async () => {
      // GIVEN
      const userId = 'user-789'

      // WHEN
      await deleteProfile(userId, gateway)

      // THEN
      expect(gateway.deletedUserId).toBe(userId)
    })
  })
})
