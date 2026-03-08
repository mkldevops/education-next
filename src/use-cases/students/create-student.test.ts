import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudent } from './create-student'

const mockFamilyGateway = {
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  list: vi.fn(),
  addPerson: vi.fn(),
  linkUser: vi.fn(),
}

const mockPersonGateway = {
  create: vi.fn(),
  update: vi.fn(),
  findById: vi.fn(),
  addPhone: vi.fn(),
}

const mockStudentGateway = {
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  findById: vi.fn(),
  list: vi.fn(),
  findByFamily: vi.fn(),
  hasActiveEnrollments: vi.fn(),
}

describe('createStudent', () => {
  let familyGateway: FamilyGatewaySpy
  let personGateway: PersonGatewaySpy
  let studentGateway: StudentGatewaySpy

  beforeEach(() => {
    familyGateway = new FamilyGatewaySpy()
    personGateway = new PersonGatewaySpy()
    studentGateway = new StudentGatewaySpy()
    familyGateway.familyToReturn = { id: 'family-123' }
    personGateway.personToReturn = { id: 'person-123' }
    studentGateway.studentToReturn = { id: 'student-123', personId: 'person-123' }
  })

  it('fails validation when input is invalid', async () => {
    // GIVEN
    const input = {
      familyId: 'invalid-uuid',
      person: { name: '', lastname: '', sex: 'MALE' },
      student: { birthday: new Date() },
    }

    // WHEN
    const result = await createStudent(input)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when family not found', async () => {
    // GIVEN
    familyGateway.familyToReturn = null
    const input = {
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2010-01-01') },
    }

    // WHEN
    const result = await createStudent(input)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when birthday is in the future', async () => {
    // GIVEN
    const input = {
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2050-01-01') },
    }

    // WHEN
    const result = await createStudent(input)

    // THEN
    expect(result).toBe('validationError')
  })

  it('creates student with valid inputs', async () => {
    // GIVEN
    const input = {
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2010-01-01') },
    }

    // WHEN
    const result = await createStudent(input)

    // THEN
    expect(result).toEqual({ id: 'student-123', personId: 'person-123' })
  })

  it('adds person to family', async () => {
    // GIVEN
    const input = {
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2010-01-01') },
    }

    // WHEN
    await createStudent(input)

    // THEN
    expect(familyGateway.addedFamilyId).toBe(input.familyId)
    expect(familyGateway.addedPersonId).toBe('person-123')
  })

  it('includes optional student fields', async () => {
    // GIVEN
    const input = {
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: {
        name: 'Jane',
        lastname: 'Smith',
        sex: 'FEMALE' as const,
        email: 'jane@example.com',
      },
      student: {
        birthday: new Date('2010-01-01'),
        birthplace: 'Paris',
        allergies: 'peanuts',
        snackAuthorization: true,
      },
    }

    // WHEN
    await createStudent(input)

    // THEN
    expect(studentGateway.createdStudentData).toMatchObject({
      birthday: new Date('2010-01-01'),
      birthplace: 'Paris',
      allergies: 'peanuts',
      snackAuthorization: true,
    })
  })
})
