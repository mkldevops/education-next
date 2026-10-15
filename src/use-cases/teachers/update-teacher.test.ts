import { beforeEach, describe, expect, it } from 'vitest'
import { updateTeacher } from './update-teacher'

type TeacherGw = Parameters<typeof updateTeacher>[1]

const schoolId = '00000000-0000-0000-0000-000000000001'
const teacherId = '123e4567-e89b-12d3-a456-426614174000'

class TeacherGatewaySpy {
  teacherToReturn: { id: string } | null = { id: teacherId }
  updatedSchoolId: string | null = null
  updatedId: string | null = null
  updatedData: unknown = null

  async findById() {
    return this.teacherToReturn
  }

  async update(updateSchoolId: string, id: string, data: unknown) {
    this.updatedSchoolId = updateSchoolId
    this.updatedId = id
    this.updatedData = data
    return { id, ...(data as object) } as never
  }
}

describe('updateTeacher', () => {
  let gateway: TeacherGatewaySpy

  beforeEach(() => {
    gateway = new TeacherGatewaySpy()
  })

  it('fails validation when id is invalid', async () => {
    const result = await updateTeacher(
      { schoolId, id: 'bad-id', firstName: 'Amina' },
      gateway as unknown as TeacherGw
    )

    expect(result).toBe('validationError')
  })

  it('fails when teacher does not exist in the school', async () => {
    gateway.teacherToReturn = null

    const result = await updateTeacher(
      { schoolId, id: teacherId, firstName: 'Amina' },
      gateway as unknown as TeacherGw
    )

    expect(result).toBe('notFound')
  })

  it('keeps the last name untouched when the update omits it', async () => {
    await updateTeacher(
      { schoolId, id: teacherId, firstName: 'Amina' },
      gateway as unknown as TeacherGw
    )

    expect(gateway.updatedData).toEqual({ firstName: 'Amina' })
  })

  it('clears the last name when the update sends an empty one', async () => {
    await updateTeacher(
      { schoolId, id: teacherId, firstName: 'Amina', lastName: '' },
      gateway as unknown as TeacherGw
    )

    expect(gateway.updatedData).toEqual({ firstName: 'Amina', lastName: '' })
  })

  it('updates teacher data without leaking id or schoolId into the payload', async () => {
    const result = await updateTeacher(
      { schoolId, id: teacherId, firstName: 'Amina', lastName: 'Benali', email: '', phone: '' },
      gateway as unknown as TeacherGw
    )

    expect(result).toHaveProperty('id', teacherId)
    expect(gateway.updatedSchoolId).toBe(schoolId)
    expect(gateway.updatedId).toBe(teacherId)
    expect(gateway.updatedData).toMatchObject({ firstName: 'Amina', lastName: 'Benali' })
    expect(gateway.updatedData).not.toHaveProperty('id')
    expect(gateway.updatedData).not.toHaveProperty('schoolId')
    expect(gateway.updatedData).toHaveProperty('email', null)
    expect(gateway.updatedData).toHaveProperty('phone', null)
  })
})
