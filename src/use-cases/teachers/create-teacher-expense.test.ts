import { beforeEach, describe, expect, it } from 'vitest'
import { createTeacherExpense } from './create-teacher-expense'

type TeacherGw = Parameters<typeof createTeacherExpense>[1]
type ConfigGw = Parameters<typeof createTeacherExpense>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'
const teacherId = '123e4567-e89b-12d3-a456-426614174000'
const requestedAt = new Date('2026-01-15')

class TeacherGatewaySpy {
  teacherToReturn: { id: string } | null = { id: teacherId }
  createdSchoolId: string | null = null
  createdData: unknown = null

  async findById() {
    return this.teacherToReturn
  }

  async createExpense(createSchoolId: string, data: unknown) {
    this.createdSchoolId = createSchoolId
    this.createdData = data
    return { id: 'expense-1', ...(data as object) } as never
  }
}

class ConfigGatewaySpy {
  configToReturn: { value: string } | null = { value: 'true' }

  async get() {
    return this.configToReturn
  }
}

describe('createTeacherExpense', () => {
  let teacherGateway: TeacherGatewaySpy
  let configGateway: ConfigGatewaySpy

  beforeEach(() => {
    teacherGateway = new TeacherGatewaySpy()
    configGateway = new ConfigGatewaySpy()
  })

  it('fails validation when amount, category, or description is invalid', async () => {
    const result = await createTeacherExpense(
      { schoolId, teacherId: 'bad-id', amount: 0, category: '', description: '', requestedAt },
      teacherGateway as unknown as TeacherGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('validationError')
  })

  it('refuses to create an expense when expense notes are not enabled', async () => {
    configGateway.configToReturn = { value: 'false' }

    const result = await createTeacherExpense(
      {
        schoolId,
        teacherId,
        amount: 42,
        category: 'Goûter',
        description: 'Sortie CP',
        requestedAt,
      },
      teacherGateway as unknown as TeacherGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notConfigured')
    expect(teacherGateway.createdData).toBeNull()
  })

  it('fails when teacher does not exist in the school', async () => {
    teacherGateway.teacherToReturn = null

    const result = await createTeacherExpense(
      {
        schoolId,
        teacherId,
        amount: 42,
        category: 'Goûter',
        description: 'Sortie CP',
        requestedAt,
      },
      teacherGateway as unknown as TeacherGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toBe('notFound')
  })

  it('creates a generic expense note for the teacher', async () => {
    const result = await createTeacherExpense(
      {
        schoolId,
        teacherId,
        amount: 42,
        category: 'Goûter',
        description: 'Sortie CP',
        requestedAt,
        paidAt: null,
      },
      teacherGateway as unknown as TeacherGw,
      configGateway as unknown as ConfigGw
    )

    expect(result).toHaveProperty('id', 'expense-1')
    expect(teacherGateway.createdSchoolId).toBe(schoolId)
    expect(teacherGateway.createdData).toMatchObject({
      teacherId,
      amount: 42,
      category: 'Goûter',
      description: 'Sortie CP',
      requestedAt,
      paidAt: null,
    })
  })
})
