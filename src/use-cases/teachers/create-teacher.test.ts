import { beforeEach, describe, expect, it } from 'vitest'
import { createTeacher } from './create-teacher'

type TeacherGw = Parameters<typeof createTeacher>[1]

const schoolId = '00000000-0000-0000-0000-000000000001'

class TeacherGatewaySpy {
  createdSchoolId: string | null = null
  createdData: unknown = null

  async create(createSchoolId: string, data: unknown) {
    this.createdSchoolId = createSchoolId
    this.createdData = data
    return { id: 'teacher-1', ...(data as object) } as never
  }
}

describe('createTeacher', () => {
  let gateway: TeacherGatewaySpy

  beforeEach(() => {
    gateway = new TeacherGatewaySpy()
  })

  it('fails validation when required names are missing', async () => {
    const result = await createTeacher(
      { schoolId, firstName: '', lastName: '', email: 'bad', phone: '123456789012345678901' },
      gateway as unknown as TeacherGw
    )

    expect(result).toBe('validationError')
  })

  it('fails validation when email exceeds the storage limit', async () => {
    const result = await createTeacher(
      {
        schoolId,
        firstName: 'Amina',
        lastName: 'Benali',
        email: `${'a'.repeat(245)}@x.test`,
      },
      gateway as unknown as TeacherGw
    )

    expect(result).toBe('validationError')
  })

  it('creates a teacher scoped to the school', async () => {
    const result = await createTeacher(
      {
        schoolId,
        firstName: 'Amina',
        lastName: 'Benali',
        email: 'amina@example.test',
        phone: '06 12 34 56 78',
      },
      gateway as unknown as TeacherGw
    )

    expect(result).toHaveProperty('id', 'teacher-1')
    expect(gateway.createdSchoolId).toBe(schoolId)
    expect(gateway.createdData).toMatchObject({
      firstName: 'Amina',
      lastName: 'Benali',
      email: 'amina@example.test',
      phone: '06 12 34 56 78',
    })
  })
})
