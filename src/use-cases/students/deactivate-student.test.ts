import { beforeEach, describe, expect, it } from 'vitest'
import { deactivateStudent } from './deactivate-student'

class StudentGatewaySpy {
  studentToReturn: { id: string; person: any } | null = null
  hasActiveEnrollmentsReturn = false
  deactivatedId: string | null = null

  async findById() {
    return this.studentToReturn
  }

  async hasActiveEnrollments() {
    return this.hasActiveEnrollmentsReturn
  }

  async deactivate(id: string) {
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
    const input = { id: 'invalid-uuid' }

    // WHEN
    const result = await deactivateStudent(input, gateway)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when student not found', async () => {
    // GIVEN
    gateway.studentToReturn = null
    const input = { id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    const result = await deactivateStudent(input, gateway)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when student has active enrollments', async () => {
    // GIVEN
    gateway.hasActiveEnrollmentsReturn = true
    const input = { id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    const result = await deactivateStudent(input, gateway)

    // THEN
    expect(result).toBe('hasActiveEnrollments')
  })

  it('deactivates student when valid', async () => {
    // GIVEN
    const input = { id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    const result = await deactivateStudent(input, gateway)

    // THEN
    expect(result).toBe('OK')
  })

  it('calls deactivate on gateway', async () => {
    // GIVEN
    const input = { id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    await deactivateStudent(input, gateway)

    // THEN
    expect(gateway.deactivatedId).toBe(input.id)
  })

  it('checks for active enrollments before deactivating', async () => {
    // GIVEN
    const input = { id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    await deactivateStudent(input, gateway)

    // THEN
    expect(gateway.hasActiveEnrollmentsReturn === false)
  })
})
