import { beforeEach, describe, expect, it } from 'vitest'
import { unassignClassPeriodTeacher } from './unassign-teacher'

type ClassPeriodGw = Parameters<typeof unassignClassPeriodTeacher>[1]

const schoolId = '00000000-0000-0000-0000-000000000001'
const classPeriodId = '123e4567-e89b-12d3-a456-426614174001'
const teacherId = '123e4567-e89b-12d3-a456-426614174010'

class ClassPeriodGatewaySpy {
  classPeriodsByIdMap: Record<string, { id: string }> = {}
  unassignResult = true
  unassignedSchoolId: string | null = null
  unassignedClassPeriodId: string | null = null
  unassignedTeacherId: string | null = null

  async findById(_schoolId: string, id: string) {
    return this.classPeriodsByIdMap[id] || null
  }

  async unassignTeacher(gwSchoolId: string, gwClassPeriodId: string, gwTeacherId: string) {
    this.unassignedSchoolId = gwSchoolId
    this.unassignedClassPeriodId = gwClassPeriodId
    this.unassignedTeacherId = gwTeacherId
    return this.unassignResult
  }
}

describe('unassignClassPeriodTeacher', () => {
  let gateway: ClassPeriodGatewaySpy

  beforeEach(() => {
    gateway = new ClassPeriodGatewaySpy()
    gateway.classPeriodsByIdMap = { [classPeriodId]: { id: classPeriodId } }
  })

  it('fails validation when teacherId is invalid', async () => {
    // GIVEN
    const input = { schoolId, id: classPeriodId, teacherId: 'bad-id' }

    // WHEN
    const result = await unassignClassPeriodTeacher(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when the class period is not found, without calling unassignTeacher', async () => {
    // GIVEN
    const input = { schoolId, id: '123e4567-e89b-12d3-a456-426614174099', teacherId }

    // WHEN
    const result = await unassignClassPeriodTeacher(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toBe('notFound')
    expect(gateway.unassignedTeacherId).toBeNull()
  })

  it('fails when no assignment matched the given teacher', async () => {
    // GIVEN
    gateway.unassignResult = false
    const input = { schoolId, id: classPeriodId, teacherId }

    // WHEN
    const result = await unassignClassPeriodTeacher(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toBe('assignmentNotFound')
  })

  it('removes the assignment scoped by school, class and teacher', async () => {
    // GIVEN
    const input = { schoolId, id: classPeriodId, teacherId }

    // WHEN
    const result = await unassignClassPeriodTeacher(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toBe('OK')
    expect(gateway.unassignedSchoolId).toBe(schoolId)
    expect(gateway.unassignedClassPeriodId).toBe(classPeriodId)
    expect(gateway.unassignedTeacherId).toBe(teacherId)
  })
})
