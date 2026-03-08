import { describe, expect, it, vi } from 'vitest'
import { Profile } from '../profile'

describe('profile domain', () => {
  describe('Profile.create', () => {
    it('should create profile with valid data', () => {
      const result = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(result).not.toBe('nameRequired')
      if (result !== 'nameRequired') {
        const profile = result
        expect(profile.userId).toBe('user1')
        expect(profile.name).toBe('John Doe')
      }
    })

    it('should create profile with bio and image', () => {
      const result = Profile.create({
        userId: 'user1',
        name: 'Jane Smith',
        bio: 'Software engineer',
        image: 'https://example.com/image.jpg',
      })

      expect(result).not.toBe('nameRequired')
      if (result !== 'nameRequired') {
        const profile = result
        expect(profile.bio).toBe('Software engineer')
        expect(profile.image).toBe('https://example.com/image.jpg')
      }
    })

    it('should return nameRequired when name is empty', () => {
      const result = Profile.create({
        userId: 'user1',
        name: '',
      })

      expect(result).toBe('nameRequired')
    })

    it('should return nameRequired when name is whitespace-only', () => {
      const result = Profile.create({
        userId: 'user1',
        name: '   ',
      })

      expect(result).toBe('nameRequired')
    })

    it('should set default values for bio and image', () => {
      const result = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(result).not.toBe('nameRequired')
      if (result !== 'nameRequired') {
        const profile = result
        expect(profile.bio).toBeNull()
        expect(profile.image).toBeNull()
      }
    })

    it('should set provided createdAt and updatedAt', () => {
      const now = new Date()
      const result = Profile.create({
        userId: 'user1',
        name: 'John Doe',
        createdAt: now,
        updatedAt: now,
      })

      expect(result).not.toBe('nameRequired')
      if (result !== 'nameRequired') {
        const profile = result
        expect(profile.state.createdAt).toBe(now.toISOString())
        expect(profile.state.updatedAt).toBe(now.toISOString())
      }
    })
  })

  describe('changeName', () => {
    it('should change name successfully', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        const result = profile.changeName('Jane Smith')

        expect(result).toBe('OK')
        expect(profile.name).toBe('Jane Smith')
      }
    })

    it('should return nameRequired when changing to empty name', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        const result = profile.changeName('')

        expect(result).toBe('nameRequired')
        expect(profile.name).toBe('John Doe')
      }
    })

    it('should return nameRequired when changing to whitespace-only name', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        const result = profile.changeName('   ')

        expect(result).toBe('nameRequired')
        expect(profile.name).toBe('John Doe')
      }
    })

    it('should update updatedAt timestamp when changing name', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        const beforeUpdate = new Date(profile.state.updatedAt)
        profile.changeName('Jane Smith')
        const afterUpdate = new Date(profile.state.updatedAt)

        expect(afterUpdate.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
      }
    })
  })

  describe('changeBio', () => {
    it('should update bio', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        profile.changeBio('Software developer')

        expect(profile.bio).toBe('Software developer')
      }
    })

    it('should set bio to null', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
        bio: 'Old bio',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        profile.changeBio(null)

        expect(profile.bio).toBeNull()
      }
    })

    it('should update updatedAt timestamp when changing bio', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        const beforeUpdate = new Date(profile.state.updatedAt)
        profile.changeBio('New bio')
        const afterUpdate = new Date(profile.state.updatedAt)

        expect(afterUpdate.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
      }
    })
  })

  describe('changeImage', () => {
    it('should update image', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        profile.changeImage('https://example.com/image.jpg')

        expect(profile.image).toBe('https://example.com/image.jpg')
      }
    })

    it('should set image to null', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
        image: 'https://example.com/old.jpg',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        profile.changeImage(null)

        expect(profile.image).toBeNull()
      }
    })

    it('should update updatedAt timestamp when changing image', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        const beforeUpdate = new Date(profile.state.updatedAt)
        profile.changeImage('https://example.com/image.jpg')
        const afterUpdate = new Date(profile.state.updatedAt)

        expect(afterUpdate.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
      }
    })
  })

  describe('state property', () => {
    it('should return correct state shape', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
        bio: 'Engineer',
        image: 'https://example.com/image.jpg',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        const state = profile.state

        expect(state).toHaveProperty('userId')
        expect(state).toHaveProperty('name')
        expect(state).toHaveProperty('bio')
        expect(state).toHaveProperty('image')
        expect(state).toHaveProperty('createdAt')
        expect(state).toHaveProperty('updatedAt')
        expect(state.userId).toBe('user1')
        expect(state.name).toBe('John Doe')
        expect(state.bio).toBe('Engineer')
        expect(state.image).toBe('https://example.com/image.jpg')
      }
    })

    it('should return ISO string dates in state', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        const state = profile.state

        expect(typeof state.createdAt).toBe('string')
        expect(typeof state.updatedAt).toBe('string')
        expect(state.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        expect(state.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      }
    })
  })

  describe('getters', () => {
    it('should provide read-only access to properties', () => {
      const profile = Profile.create({
        userId: 'user1',
        name: 'John Doe',
        bio: 'Engineer',
        image: 'https://example.com/image.jpg',
      })

      expect(profile).not.toBe('nameRequired')
      if (profile !== 'nameRequired') {
        expect(profile.userId).toBe('user1')
        expect(profile.name).toBe('John Doe')
        expect(profile.bio).toBe('Engineer')
        expect(profile.image).toBe('https://example.com/image.jpg')
      }
    })
  })
})
