import { beforeEach, describe, expect, it } from 'vitest'
import type { EnrollmentGateway } from '@/gateways/enrollment-gateway'
import { completeEnrollment } from './complete-enrollment'

class EnrollmentGatewaySpy implements EnrollmentGateway {
  enrollmentToReturn: any = null
  updatedId: string | null = null
  updatedStatus: any = null

  async findById(id: string) {
    return this.enrollmentToReturn
  }

  async updateStatus(id: string, status: any) {
    this.updatedId = id
    this.updatedStatus = status
  }
}

describe('completeEnrollment', () => {
  let gateway: EnrollmentGatewaySpy

  beforeEach(() => {
    gateway = new EnrollmentGatewaySpy()
  })

  it('should fail validation with invalid input', async () => {
    const result = await completeEnrollment({
      id: 'invalid-uuid',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with enrollment not found', async () => {
    gateway.enrollmentToReturn = null

    const result = await completeEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('notFound')
  })

  it('should fail when transitioning from PENDING status', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
    }

    const result = await completeEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should fail when transitioning from COMPLETED status', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'COMPLETED',
    }

    const result = await completeEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should fail when transitioning from CANCELLED status', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'CANCELLED',
    }

    const result = await completeEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should succeed when transitioning from ACTIVE status', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    }

    const result = await completeEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('OK')
  })

  it('should update enrollment status to COMPLETED', async () => {
    gateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    }

    await completeEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(gateway.updatedId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(gateway.updatedStatus).toBe('COMPLETED')
  })
})
