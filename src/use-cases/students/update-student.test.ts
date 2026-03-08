import { beforeEach, describe, expect, it } from 'vitest'
import { updateStudent } from './update-student'

class StudentGatewaySpy {
  studentToReturn: { id: string; person: any } | null = null
  updatedId: string | null = null
  updatedData: unknown = null

  async findById() {
    return this.studentToReturn
  }

  async update(id: string, data: unknown) {
    this.updatedId = id
    this.updatedData = data
    const existing = this.studentToReturn || {}
    return { id, ...existing, ...(data as object) } as unknown as any
  }

  async create() {
    return {} as never
  }

  async deactivate() {
    return {} as never
  }

  async list() {
    return []
  }

  async findByFamily() {
    return []
  }

  async hasActiveEnrollments() {
    return false
  }
}

describe('updateStudent', () => {
  let gateway: StudentGatewaySpy

  beforeEach(() => {
    gateway = new StudentGatewaySpy()
    gateway.studentToReturn = { id: 'student-123', person: {} }
  })

  it('fails validation when input is invalid', async () => {
    // GIVEN
    const input = { id: 'invalid-uuid' }

    // WHEN
    const result = await updateStudent(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when student not found', async () => {
    // GIVEN
    gateway.studentToReturn = null
    const input = { id: '123e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    const result = await updateStudent(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when birthday is in the future', async () => {
    // GIVEN
    const input = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      birthday: new Date('2050-01-01'),
    }

    // WHEN
    const result = await updateStudent(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('updates student with valid birthday', async () => {
    // GIVEN
    const input = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      birthday: new Date('2010-01-01'),
    }

    // WHEN
    const result = await updateStudent(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', 'student-123')
  })

  it('updates student without birthday', async () => {
    // GIVEN
    const input = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      allergies: 'peanuts',
    }

    // WHEN
    const result = await updateStudent(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', 'student-123')
  })

  it('calls update with correct data', async () => {
    // GIVEN
    const input = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      birthplace: 'Paris',
      allergies: 'shellfish',
    }

    // WHEN
    await updateStudent(input, gateway as unknown as any)

    // THEN
    expect(gateway.updatedId).toBe(input.id)
    expect(gateway.updatedData).toMatchObject({
      birthplace: 'Paris',
      allergies: 'shellfish',
    })
  })

  it('excludes id from update data', async () => {
    // GIVEN
    const input = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      healthNotes: 'Asthmatic',
    }

    // WHEN
    await updateStudent(input, gateway as unknown as any)

    // THEN
    expect(gateway.updatedData).not.toHaveProperty('id')
  })
})
