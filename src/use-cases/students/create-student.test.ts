import { beforeEach, describe, expect, it } from 'vitest'
import { createStudent } from './create-student'

class FamilyGatewaySpy {
  familyToReturn: { id: string } | null = null
  addPersonCalls: Array<{ familyId: string; personId: string }> = []

  async findById() {
    return this.familyToReturn
  }

  async addPerson(familyId: string, personId: string) {
    this.addPersonCalls.push({ familyId, personId })
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

  async create(data: unknown) {
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
  studentToReturn: any = null

  async create(data: unknown) {
    this.createdData = data
    return this.studentToReturn || { id: 'student-123' }
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
      familyId: 'invalid-uuid',
      person: { name: '', lastname: '', sex: 'MALE' as const },
      student: { birthday: new Date() },
    }

    // WHEN
    const result = await createStudent(input, familyGateway, personGateway, studentGateway)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when family not found', async () => {
    // GIVEN
    familyGateway.familyToReturn = null
    const input = {
      familyId: '123e4567-e89b-12d3-a456-426614174001',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2010-01-01') },
    }

    // WHEN
    const result = await createStudent(input, familyGateway, personGateway, studentGateway)

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
    const result = await createStudent(input, familyGateway, personGateway, studentGateway)

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
    const result = await createStudent(input, familyGateway, personGateway, studentGateway)

    // THEN
    expect(result).toEqual({ id: 'student-123' })
  })

  it('creates person with provided data', async () => {
    // GIVEN
    const input = {
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: {
        name: 'Jane',
        lastname: 'Smith',
        sex: 'FEMALE' as const,
        email: 'jane@example.com',
      },
      student: { birthday: new Date('2010-01-01') },
    }

    // WHEN
    await createStudent(input, familyGateway, personGateway, studentGateway)

    // THEN
    expect(personGateway.createdData).toMatchObject({
      name: 'Jane',
      lastname: 'Smith',
      sex: 'FEMALE',
      email: 'jane@example.com',
    })
  })

  it('creates student with personId and birthday', async () => {
    // GIVEN
    const input = {
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2010-01-01'), birthplace: 'Paris', allergies: 'peanuts' },
    }

    // WHEN
    await createStudent(input, familyGateway, personGateway, studentGateway)

    // THEN
    expect(studentGateway.createdData).toMatchObject({
      personId: 'person-123',
      birthday: new Date('2010-01-01'),
      birthplace: 'Paris',
      allergies: 'peanuts',
    })
  })

  it('adds person to family after student creation', async () => {
    // GIVEN
    const input = {
      familyId: '123e4567-e89b-12d3-a456-426614174000',
      person: { name: 'John', lastname: 'Doe', sex: 'MALE' as const },
      student: { birthday: new Date('2010-01-01') },
    }

    // WHEN
    await createStudent(input, familyGateway, personGateway, studentGateway)

    // THEN
    expect(familyGateway.addPersonCalls).toContainEqual({
      familyId: input.familyId,
      personId: 'person-123',
    })
  })
})
