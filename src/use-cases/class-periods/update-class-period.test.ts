import { beforeEach, describe, expect, it } from 'vitest'
import { updateClassPeriod } from './update-class-period'

type ClassPeriodGw = Parameters<typeof updateClassPeriod>[1]
type TeacherGw = Parameters<typeof updateClassPeriod>[2]

const schoolId = '00000000-0000-0000-0000-000000000001'

class ClassPeriodGatewaySpy {
  classPeriodsByIdMap: Record<string, { id: string; name: string; capacity: number }> = {}
  enrolledCountToReturn = 0
  updatedSchoolId: string | null = null
  updatedId: string | null = null
  updatedData: unknown = null

  async findById(_findSchoolId: string, id: string) {
    return this.classPeriodsByIdMap[id] || null
  }

  async countEnrolled() {
    return this.enrolledCountToReturn
  }

  async update(updateSchoolId: string, id: string, data: unknown) {
    this.updatedSchoolId = updateSchoolId
    this.updatedId = id
    this.updatedData = data
    const existing = this.classPeriodsByIdMap[id] || {}
    return { ...existing, id, ...(data as object) } as never
  }

  async create() {
    return {} as never
  }

  async list() {
    return []
  }

  async findByLevelAndPeriod() {
    return null
  }
}

class TeacherGatewaySpy {
  teachersToReturn: Array<{ id: string }> = []

  async findByIds() {
    return this.teachersToReturn
  }
}

describe('updateClassPeriod', () => {
  let gateway: ClassPeriodGatewaySpy
  let teacherGateway: TeacherGatewaySpy
  const classPeriodId1 = '123e4567-e89b-12d3-a456-426614174001'

  beforeEach(() => {
    gateway = new ClassPeriodGatewaySpy()
    teacherGateway = new TeacherGatewaySpy()
    gateway.classPeriodsByIdMap = {
      [classPeriodId1]: {
        id: classPeriodId1,
        name: 'Class A',
        capacity: 30,
      },
    }
  })

  it('fails validation when id is invalid', async () => {
    // GIVEN
    const input = { schoolId, id: 'invalid-uuid', name: 'Updated Class' }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when class period not found', async () => {
    // GIVEN
    const input = { schoolId, id: '123e4567-e89b-12d3-a456-426614174000', name: 'Class B' }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when reducing capacity below enrolled count', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 25
    const input = {
      schoolId,
      id: classPeriodId1,
      capacity: 20,
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toBe('capacityBelowEnrolled')
  })

  it('fails when one selected teacher does not belong to the school', async () => {
    // GIVEN
    const input = {
      schoolId,
      id: classPeriodId1,
      teacherIds: ['123e4567-e89b-12d3-a456-426614174010', '123e4567-e89b-12d3-a456-426614174011'],
    }

    // WHEN
    const result = await updateClassPeriod(
      input,
      gateway as unknown as ClassPeriodGw,
      teacherGateway as unknown as TeacherGw
    )

    // THEN
    expect(result).toBe('teacherNotFound')
  })

  it('updates class period name only', async () => {
    // GIVEN
    const input = {
      schoolId,
      id: classPeriodId1,
      name: 'Updated Class A',
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })

  it('updates class period capacity when valid', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 20
    const input = {
      schoolId,
      id: classPeriodId1,
      capacity: 25,
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })

  it('updates capacity when equal to enrolled count', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 25
    const input = {
      schoolId,
      id: classPeriodId1,
      capacity: 25,
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })

  it('updates both name and capacity', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 15
    const input = {
      schoolId,
      id: classPeriodId1,
      name: 'Class B',
      capacity: 28,
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })

  it('replaces the class teachers when teacher ids are supplied', async () => {
    // GIVEN
    const teacherIds = [
      '123e4567-e89b-12d3-a456-426614174010',
      '123e4567-e89b-12d3-a456-426614174011',
    ]
    teacherGateway.teachersToReturn = teacherIds.map((id) => ({ id }))
    const input = {
      schoolId,
      id: classPeriodId1,
      teacherIds,
    }

    // WHEN
    const result = await updateClassPeriod(
      input,
      gateway as unknown as ClassPeriodGw,
      teacherGateway as unknown as TeacherGw
    )

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
    expect(gateway.updatedData).toMatchObject({ teacherIds })
  })

  it('excludes id and schoolId from update data sent to gateway', async () => {
    // GIVEN
    const input = {
      schoolId,
      id: classPeriodId1,
      name: 'Updated Name',
    }

    // WHEN
    await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(gateway.updatedData).not.toHaveProperty('id')
    expect(gateway.updatedData).not.toHaveProperty('schoolId')
  })

  it('sends correct schoolId to gateway', async () => {
    // GIVEN
    const input = {
      schoolId,
      id: classPeriodId1,
      name: 'Updated Name',
    }

    // WHEN
    await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(gateway.updatedSchoolId).toBe(schoolId)
  })

  it('does not check capacity when only name is updated', async () => {
    // GIVEN
    gateway.enrolledCountToReturn = 100
    const input = {
      schoolId,
      id: classPeriodId1,
      name: 'New Name',
    }

    // WHEN
    const result = await updateClassPeriod(input, gateway as unknown as ClassPeriodGw)

    // THEN
    expect(result).toHaveProperty('id', classPeriodId1)
  })
})
