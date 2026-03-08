import { beforeEach, describe, expect, it } from 'vitest'
import type { EnrollmentGateway } from '@/gateways/enrollment-gateway'
import { applyDiscount } from './apply-discount'

class EnrollmentGatewaySpy implements EnrollmentGateway {
  enrollmentToReturn: any = null
  updatedId: string | null = null
  updatedDiscount: number | null = null
  updatedTotalAmount: number | null = null

  async findById(id: string) {
    return this.enrollmentToReturn
  }

  async updateDiscount(id: string, discount: number, totalAmount: number) {
    this.updatedId = id
    this.updatedDiscount = discount
    this.updatedTotalAmount = totalAmount
  }
}

describe('applyDiscount', () => {
  let gateway: EnrollmentGatewaySpy

  beforeEach(() => {
    gateway = new EnrollmentGatewaySpy()
  })

  it('should fail validation with invalid input', async () => {
    const result = await applyDiscount({
      enrollmentId: 'invalid-uuid',
      discount: 10,
    })

    expect(result).toBe('validationError')
  })

  it('should fail validation with negative discount', async () => {
    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: -10,
    })

    expect(result).toBe('validationError')
  })

  it('should fail with enrollment not found', async () => {
    gateway.enrollmentToReturn = null

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 10,
    })

    expect(result).toBe('notFound')
  })

  it('should succeed when applying discount to existing enrollment', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    }

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 10,
    })

    expect(result).toBe('OK')
  })

  it('should update enrollment with correct discount', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    }

    await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 10,
    })

    expect(gateway.updatedId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(gateway.updatedDiscount).toBe(10)
  })

  it('should calculate correct total amount after discount', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    }

    await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 25,
    })

    expect(gateway.updatedTotalAmount).toBe(75)
  })

  it('should handle zero discount', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    }

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 0,
    })

    expect(result).toBe('OK')
    expect(gateway.updatedTotalAmount).toBe(100)
  })

  it('should handle discount equal to plan amount', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      plan: { amount: 100 },
    }

    const result = await applyDiscount({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      discount: 100,
    })

    expect(result).toBe('OK')
    expect(gateway.updatedTotalAmount).toBe(0)
  })
})
