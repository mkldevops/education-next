import { beforeEach, describe, expect, it } from 'vitest'
import type { ClassAssignmentGateway } from '@/gateways/class-assignment-gateway'
import type { EnrollmentGateway } from '@/gateways/enrollment-gateway'
import { cancelEnrollment } from './cancel-enrollment'

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

class ClassAssignmentGatewaySpy implements ClassAssignmentGateway {
  closedEnrollmentId: string | null = null

  async closeCurrent(enrollmentId: string) {
    this.closedEnrollmentId = enrollmentId
  }
}

describe('cancelEnrollment', () => {
  let enrollmentGateway: EnrollmentGatewaySpy
  let classAssignmentGateway: ClassAssignmentGatewaySpy

  beforeEach(() => {
    enrollmentGateway = new EnrollmentGatewaySpy()
    classAssignmentGateway = new ClassAssignmentGatewaySpy()
  })

  it('should fail validation with invalid input', async () => {
    const result = await cancelEnrollment({
      id: 'invalid-uuid',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with enrollment not found', async () => {
    enrollmentGateway.enrollmentToReturn = null

    const result = await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('notFound')
  })

  it('should fail when transitioning from COMPLETED status', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'COMPLETED',
    }

    const result = await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should fail when transitioning from CANCELLED status', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'CANCELLED',
    }

    const result = await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should succeed when transitioning from PENDING status', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
    }

    const result = await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('OK')
  })

  it('should succeed when transitioning from ACTIVE status', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    }

    const result = await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('OK')
  })

  it('should close current class assignment', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    }

    await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(classAssignmentGateway.closedEnrollmentId).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('should update enrollment status to CANCELLED', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    }

    await cancelEnrollment({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(enrollmentGateway.updatedId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(enrollmentGateway.updatedStatus).toBe('CANCELLED')
  })
})
