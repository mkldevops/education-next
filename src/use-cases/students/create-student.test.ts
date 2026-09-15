import { beforeEach, describe, expect, it } from 'vitest'
import { createStudent } from './create-student'

type FamilyGw = Parameters<typeof createStudent>[1]
type PersonGw = Parameters<typeof createStudent>[2]
type StudentGw = Parameters<typeof createStudent>[3]

class FamilyGatewaySpy {
  familyToReturn: { id: string } | null = null
  addPersonCalls: Array<{ schoolId: string; familyId: string; personId: string }> = []

  async findById() {
    return this.familyToReturn
  }

  async addPerson(schoolId: string, familyId: string, personId: string) {
    this.addPersonCalls.push({ schoolId, familyId, personId })
  }

  async create() {
    return {} as never
  }

  async update() {
    return {} as never
  }

  async deactivate() {
    return {} as never
  }

  async list() {
    return []
  }

  async linkUser() {
    return {} as never
  }
}

class PersonGatewaySpy {
  personToReturn: { id: string } | null = null
  createdData: unknown = null

  async create(_schoolId: string, data: unknown) {
    this.createdData = data
    return this.personToReturn || { id: 'person-123' }
  }

  async update() {
    return {} as never
  }

  async findById() {
    return {} as never
  }

  async addPhone() {
    return {} as never
  }
}

class StudentGatewaySpy {
  createdData: unknown = null
  studentToReturn: unknown = null

  async create(_schoolId: string, data: unknown) {
    this.createdData = data
    return (this.studentToReturn || { id: 'student-123' }) as never
  }

  async update() {
    return {} as never
  }

  async deactivate() {
    return {} as never
  }

  async findById() {
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
    studentGateway.studentToReturn = { id: 'student-123' }
  })

  it('fails validation when input is invalid', async () => {
    // GIVEN
    const input = {
      schoolId: 'school-1',
      familyId: 'invalid-uuid',
      person: { name: '', lastname: '', sex: 'MALE' as const },
      student: { birthday: new Date(), snackAuthorization: false },
    }

    // WHEN
    const result = await createStudent(
      input as never,
      familyGateway as unknown as FamilyGw,
      personGateway as unknown as PersonGw,
      studentGateway as unknown as StudentGw
    )

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when family not found', async () => {
    // GIVEN
    familyGateway.familyToReturn = null
    const input = {
      schoolId: 'school-1',
      familyId: '123e4567-e89b-12d3-a456-426614174001',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2010-01-01'), snackAuthorization: false },
    }

    // WHEN
    const result = await createStudent(
      input as never,
      familyGateway as unknown as FamilyGw,
      personGateway as unknown as PersonGw,
      studentGateway as unknown as StudentGw
    )

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when birthday is in the future', async () => {
    // GIVEN
    const input = {
      schoolId: 'school-1',
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2050-01-01'), snackAuthorization: false },
    }

    // WHEN
    const result = await createStudent(
      input as never,
      familyGateway as unknown as FamilyGw,
      personGateway as unknown as PersonGw,
      studentGateway as unknown as StudentGw
    )

    // THEN
    expect(result).toBe('validationError')
  })

  it('creates student with valid inputs', async () => {
    // GIVEN
    const input = {
      schoolId: 'school-1',
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2010-01-01'), snackAuthorization: false },
    }

    // WHEN
    const result = await createStudent(
      input as never,
      familyGateway as unknown as FamilyGw,
      personGateway as unknown as PersonGw,
      studentGateway as unknown as StudentGw
    )

    // THEN
    expect(result).toEqual({ id: 'student-123' })
  })

  it('creates a student whose sex and birthday are unknown', async () => {
    // GIVEN
    const input = {
      schoolId: 'school-1',
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'Ylias', lastname: 'Youssouf' },
      student: { snackAuthorization: false },
    }

    // WHEN
    const result = await createStudent(
      input as never,
      familyGateway as unknown as FamilyGw,
      personGateway as unknown as PersonGw,
      studentGateway as unknown as StudentGw
    )

    // THEN
    expect(result).toEqual({ id: 'student-123' })
    expect(personGateway.createdData).not.toHaveProperty('sex')
  })

  it('stores a birthday sent as null as unknown instead of dating it 1970', async () => {
    // GIVEN
    const input = {
      schoolId: 'school-1',
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'Ylias', lastname: 'Youssouf' },
      student: { birthday: null, snackAuthorization: false },
    }

    // WHEN
    const result = await createStudent(
      input as never,
      familyGateway as unknown as FamilyGw,
      personGateway as unknown as PersonGw,
      studentGateway as unknown as StudentGw
    )

    // THEN
    expect(result).toEqual({ id: 'student-123' })
    expect(studentGateway.createdData).toMatchObject({ birthday: null })
  })

  it('creates person with provided data', async () => {
    // GIVEN
    const input = {
      schoolId: 'school-1',
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: {
        name: 'Jane',
        lastname: 'Smith',
        sex: 'FEMALE' as const,
        email: 'jane@example.com',
      },
      student: { birthday: new Date('2010-01-01'), snackAuthorization: false },
    }

    // WHEN
    await createStudent(
      input as never,
      familyGateway as unknown as FamilyGw,
      personGateway as unknown as PersonGw,
      studentGateway as unknown as StudentGw
    )

    // THEN
    expect(personGateway.createdData).toMatchObject({
      name: 'Jane',
      lastname: 'Smith',
      sex: 'FEMALE',
      email: 'jane@example.com',
    })
  })

  it('creates student with optional fields', async () => {
    // GIVEN
    const input = {
      schoolId: 'school-1',
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: {
        birthday: new Date('2010-01-01'),
        snackAuthorization: true,
        birthplace: 'Paris',
        allergies: 'Peanuts',
      },
    }

    // WHEN
    await createStudent(
      input as never,
      familyGateway as unknown as FamilyGw,
      personGateway as unknown as PersonGw,
      studentGateway as unknown as StudentGw
    )

    // THEN
    expect(studentGateway.createdData).toMatchObject({
      birthday: new Date('2010-01-01'),
      snackAuthorization: true,
      birthplace: 'Paris',
      allergies: 'Peanuts',
    })
  })

  it('adds created person to family', async () => {
    // GIVEN
    const input = {
      schoolId: 'school-1',
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2010-01-01'), snackAuthorization: false },
    }

    // WHEN
    await createStudent(
      input as never,
      familyGateway as unknown as FamilyGw,
      personGateway as unknown as PersonGw,
      studentGateway as unknown as StudentGw
    )

    // THEN
    expect(familyGateway.addPersonCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schoolId: 'school-1',
          familyId: '123e4567-e89b-12d3-a456-426614174000',
          personId: 'person-123',
        }),
      ])
    )
  })
})
