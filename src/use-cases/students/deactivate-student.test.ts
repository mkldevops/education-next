import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stopStudentMeals } from '@/use-cases/meals/stop-student-meals'
import { deactivateStudent } from './deactivate-student'

vi.mock('@/use-cases/meals/stop-student-meals', () => ({ stopStudentMeals: vi.fn() }))

type Gateway = Parameters<typeof deactivateStudent>[1]

class StudentGatewaySpy {
  studentToReturn: { id: string; person: unknown } | null = null
  hasActiveEnrollmentsReturn = false
  deactivatedSchoolId: string | null = null
  deactivatedId: string | null = null

  async findById() {
    return this.studentToReturn
  }

  async hasActiveEnrollments() {
    return this.hasActiveEnrollmentsReturn
  }

  async deactivate(schoolId: string, id: string) {
    this.deactivatedSchoolId = schoolId
    this.deactivatedId = id
  }

  async create() {
    return {} as never
  }

  async update() {
    return {} as never
  }

  async list() {
    return []
  }

  async findByFamily() {
    return []
  }
}

describe('deactivateStudent', () => {
  let gateway: StudentGatewaySpy

  beforeEach(() => {
    gateway = new StudentGatewaySpy()
    gateway.studentToReturn = { id: 'student-123', person: {} }
    gateway.hasActiveEnrollmentsReturn = false
  })

  it('fails validation when id is invalid', async () => {
    // GIVEN
    const input = { schoolId: 'school-1', id: 'invalid-uuid' }

    // WHEN
    const result = await deactivateStudent(input, gateway as unknown as Gateway)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when student not found', async () => {
    // GIVEN
    gateway.studentToReturn = null
    const input = { schoolId: 'school-1', id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    const result = await deactivateStudent(input, gateway as unknown as Gateway)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when student has active enrollments', async () => {
    // GIVEN
    gateway.hasActiveEnrollmentsReturn = true
    const input = { schoolId: 'school-1', id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    const result = await deactivateStudent(input, gateway as unknown as Gateway)

    // THEN
    expect(result).toBe('hasActiveEnrollments')
  })

  it('deactivates student when valid', async () => {
    // GIVEN
    const input = { schoolId: 'school-1', id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    const result = await deactivateStudent(input, gateway as unknown as Gateway)

    // THEN
    expect(result).toBe('OK')
  })

  it('calls deactivate on gateway', async () => {
    // GIVEN
    const input = { schoolId: 'school-1', id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    await deactivateStudent(input, gateway as unknown as Gateway)

    // THEN
    expect(gateway.deactivatedSchoolId).toBe(input.schoolId)
    expect(gateway.deactivatedId).toBe(input.id)
  })

  it('checks for active enrollments before deactivating', async () => {
    // GIVEN
    const input = { schoolId: 'school-1', id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    await deactivateStudent(input, gateway as unknown as Gateway)

    // THEN
    expect(gateway.hasActiveEnrollmentsReturn === false)
  })

  it('stops the student meals once archived', async () => {
    const input = { schoolId: 'school-1', id: '123e4567-e89b-12d3-a456-426614174000' }

    await deactivateStudent(input, gateway as unknown as Gateway)

    expect(stopStudentMeals).toHaveBeenCalledWith({ schoolId: input.schoolId, studentId: input.id })
  })
})
