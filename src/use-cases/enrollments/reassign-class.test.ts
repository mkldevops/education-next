import { beforeEach, describe, expect, it } from 'vitest'
import type { ClassAssignmentGateway } from '@/gateways/class-assignment-gateway'
import type { ClassPeriodGateway } from '@/gateways/class-period-gateway'
import type { EnrollmentGateway } from '@/gateways/enrollment-gateway'
import { reassignClass } from './reassign-class'

class EnrollmentGatewaySpy implements EnrollmentGateway {
  enrollmentToReturn: any = null

  async findById(id: string) {
    return this.enrollmentToReturn
  }
}

class ClassPeriodGatewaySpy implements ClassPeriodGateway {
  classPeriodToReturn: any = null
  countEnrolledToReturn = 0

  async findById(id: string) {
    return this.classPeriodToReturn
  }

  async countEnrolled(id: string) {
    return this.countEnrolledToReturn
  }
}

class ClassAssignmentGatewaySpy implements ClassAssignmentGateway {
  closedEnrollmentId: string | null = null
  createdData: any = null

  async closeCurrent(enrollmentId: string) {
    this.closedEnrollmentId = enrollmentId
  }

  async create(data: any) {
    this.createdData = data
  }
}

describe('reassignClass', () => {
  let enrollmentGateway: EnrollmentGatewaySpy
  let classPeriodGateway: ClassPeriodGatewaySpy
  let classAssignmentGateway: ClassAssignmentGatewaySpy

  beforeEach(() => {
    enrollmentGateway = new EnrollmentGatewaySpy()
    classPeriodGateway = new ClassPeriodGatewaySpy()
    classAssignmentGateway = new ClassAssignmentGatewaySpy()
  })

  it('should fail validation with invalid input', async () => {
    const result = await reassignClass({
      enrollmentId: 'invalid-uuid',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with enrollment not found', async () => {
    enrollmentGateway.enrollmentToReturn = null

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('notFound')
  })

  it('should fail when enrollment status is COMPLETED', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'COMPLETED',
    }

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should fail when enrollment status is CANCELLED', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'CANCELLED',
    }

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('invalidStatusTransition')
  })

  it('should fail with new class period not found', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
    }
    classPeriodGateway.classPeriodToReturn = null

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('notFound')
  })

  it('should fail when new class period is full', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
    }
    classPeriodGateway.classPeriodToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    }
    classPeriodGateway.countEnrolledToReturn = 10

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('classFull')
  })

  it('should succeed when reassigning from PENDING status', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
    }
    classPeriodGateway.classPeriodToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    }
    classPeriodGateway.countEnrolledToReturn = 5

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('OK')
  })

  it('should succeed when reassigning from ACTIVE status', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    }
    classPeriodGateway.classPeriodToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    }
    classPeriodGateway.countEnrolledToReturn = 5

    const result = await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(result).toBe('OK')
  })

  it('should close current class assignment during reassignment', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    }
    classPeriodGateway.classPeriodToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    }
    classPeriodGateway.countEnrolledToReturn = 5

    await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(classAssignmentGateway.closedEnrollmentId).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('should create new class assignment', async () => {
    enrollmentGateway.enrollmentToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ACTIVE',
    }
    classPeriodGateway.classPeriodToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      capacity: 10,
    }
    classPeriodGateway.countEnrolledToReturn = 5

    await reassignClass({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      newClassPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })

    expect(classAssignmentGateway.createdData).toEqual({
      enrollmentId: '550e8400-e29b-41d4-a716-446655440000',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440001',
    })
  })
})
