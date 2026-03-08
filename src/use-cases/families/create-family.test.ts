import { beforeEach, describe, expect, it } from 'vitest'
import type { FamilyGateway } from '@/gateways/family-gateway'
import { createFamily } from './create-family'

class FamilyGatewaySpy implements FamilyGateway {
  createdData: any = null

  async create(data: any) {
    this.createdData = data
    return {
      id: '550e8400-e29b-41d4-a716-446655440000',
      ...data,
    }
  }
}

describe('createFamily', () => {
  let gateway: FamilyGatewaySpy

  beforeEach(() => {
    gateway = new FamilyGatewaySpy()
  })

  it('should fail validation with invalid input', async () => {
    const result = await createFamily({
      name: '',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation when name exceeds max length', async () => {
    const longName = 'a'.repeat(51)
    const result = await createFamily({
      name: longName,
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail when name is only whitespace', async () => {
    const result = await createFamily({
      name: '   ',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should succeed with valid family name', async () => {
    const result = await createFamily({
      name: 'Dupont Family',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).not.toBe('validationError')
    expect(result).toHaveProperty('id')
  })

  it('should create family with provided name', async () => {
    await createFamily({
      name: 'Martin Family',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(gateway.createdData.name).toBe('Martin Family')
  })

  it('should create family with createdById', async () => {
    const createdById = '550e8400-e29b-41d4-a716-446655440001'
    await createFamily({
      name: 'Silva Family',
      createdById,
    })

    expect(gateway.createdData.createdById).toBe(createdById)
  })

  it('should create family with optional emergency contact', async () => {
    await createFamily({
      name: 'Garcia Family',
      emergencyContact: 'Emergency contact info',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(gateway.createdData.emergencyContact).toBe('Emergency contact info')
  })

  it('should create family with optional authorized pickup', async () => {
    await createFamily({
      name: 'Lopez Family',
      authorizedPickup: 'John Doe',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(gateway.createdData.authorizedPickup).toBe('John Doe')
  })

  it('should return created family', async () => {
    const result = await createFamily({
      name: 'Torres Family',
      emergencyContact: 'Contact',
      createdById: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('name', 'Torres Family')
  })
})
