import { beforeEach, describe, expect, it } from 'vitest'
import type { ClassPeriodGateway } from '@/gateways/class-period-gateway'
import type { EnrollmentGateway } from '@/gateways/enrollment-gateway'
import type { PlanGateway } from '@/gateways/plan-gateway'
import type { StudentGateway } from '@/gateways/student-gateway'
import { createEnrollment } from './create-enrollment'

class StudentGatewaySpy implements StudentGateway {
  studentToReturn: any = null

  async findById(id: string) {
    return this.studentToReturn
  }
}

class PlanGatewaySpy implements PlanGateway {
  planToReturn: any = null

  async findById(id: string) {
    return this.planToReturn
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

class EnrollmentGatewaySpy implements EnrollmentGateway {
  duplicateToReturn = false

  async findDuplicate(studentId: string, classPeriodId: string) {
    return this.duplicateToReturn
  }
}

describe('createEnrollment', () => {
  let studentGateway: StudentGatewaySpy
  let planGateway: PlanGatewaySpy
  let classPeriodGateway: ClassPeriodGatewaySpy
  let enrollmentGateway: EnrollmentGatewaySpy

  beforeEach(() => {
    studentGateway = new StudentGatewaySpy()
    planGateway = new PlanGatewaySpy()
    classPeriodGateway = new ClassPeriodGatewaySpy()
    enrollmentGateway = new EnrollmentGatewaySpy()
  })

  it('should fail validation with invalid input', async () => {
    const result = await createEnrollment({
      studentId: 'invalid-uuid',
      planId: '550e8400-e29b-41d4-a716-446655440000',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result).toBe('validationError')
  })

  it('should fail with student not found', async () => {
    studentGateway.studentToReturn = null

    const result = await createEnrollment({
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
    })

    expect(result).toBe('notFound')
  })

  it('should fail with plan not found', async () => {
    studentGateway.studentToReturn = { id: '550e8400-e29b-41d4-a716-446655440000' }
    planGateway.planToReturn = null

    const result = await createEnrollment({
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
    })

    expect(result).toBe('notFound')
  })

  it('should fail with class period not found', async () => {
    studentGateway.studentToReturn = { id: '550e8400-e29b-41d4-a716-446655440000' }
    planGateway.planToReturn = { id: '550e8400-e29b-41d4-a716-446655440001', amount: 100 }
    classPeriodGateway.classPeriodToReturn = null

    const result = await createEnrollment({
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
    })

    expect(result).toBe('notFound')
  })

  it('should fail with duplicate enrollment', async () => {
    studentGateway.studentToReturn = { id: '550e8400-e29b-41d4-a716-446655440000' }
    planGateway.planToReturn = { id: '550e8400-e29b-41d4-a716-446655440001', amount: 100 }
    classPeriodGateway.classPeriodToReturn = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      capacity: 10,
    }
    enrollmentGateway.duplicateToReturn = true

    const result = await createEnrollment({
      studentId: '550e8400-e29b-41d4-a716-446655440000',
      planId: '550e8400-e29b-41d4-a716-446655440001',
      classPeriodId: '550e8400-e29b-41d4-a716-446655440002',
    })

    expect(result).toBe('duplicateEnrollment')
  })
})
