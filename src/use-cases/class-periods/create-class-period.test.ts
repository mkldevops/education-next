import { beforeEach, describe, expect, it } from 'vitest'
import { createClassPeriod } from './create-class-period'

type ClassPeriodGw = Parameters<typeof createClassPeriod>[1]
type LevelGw = Parameters<typeof createClassPeriod>[2]
type PeriodGw = Parameters<typeof createClassPeriod>[3]

const schoolId = '00000000-0000-0000-0000-000000000001'

class LevelGatewaySpy {
  levelToReturn: { id: string } | null = null

  async findById() {
    return this.levelToReturn
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

  async setNextLevel() {
    return {} as never
  }
}

class PeriodGatewaySpy {
  periodToReturn: { id: string } | null = null

  async findById() {
    return this.periodToReturn
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

  async checkOverlap() {
    return false
  }
}

class ClassPeriodGatewaySpy {
  createdSchoolId: string | null = null
  createdData: unknown = null
  classPeriodToReturn: unknown = null

  async create(createSchoolId: string, data: unknown) {
    this.createdSchoolId = createSchoolId
    this.createdData = data
    return (this.classPeriodToReturn || {
      id: 'class-period-123',
      ...(data as object),
    }) as never
  }

  async update() {
    return {} as never
  }

  async findById() {
    return {} as never
  }

  async list() {
    return []
  }

  async countEnrolled() {
    return 0
  }

  async findByLevelAndPeriod() {
    return null
  }
}

describe('createClassPeriod', () => {
  let classPeriodGateway: ClassPeriodGatewaySpy
  let levelGateway: LevelGatewaySpy
  let periodGateway: PeriodGatewaySpy

  beforeEach(() => {
    classPeriodGateway = new ClassPeriodGatewaySpy()
    levelGateway = new LevelGatewaySpy()
    periodGateway = new PeriodGatewaySpy()
    levelGateway.levelToReturn = { id: 'level-123' }
    periodGateway.periodToReturn = { id: 'period-123' }
  })

  it('fails validation when input is invalid', async () => {
    // GIVEN
    const input = {
      schoolId,
      name: '',
      capacity: 0,
      levelId: 'invalid-uuid',
      periodId: 'invalid-uuid',
    }

    // WHEN
    const result = await createClassPeriod(
      input,
      classPeriodGateway as unknown as ClassPeriodGw,
      levelGateway as unknown as LevelGw,
      periodGateway as unknown as PeriodGw
    )

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when level not found', async () => {
    // GIVEN
    levelGateway.levelToReturn = null
    const input = {
      schoolId,
      name: 'Class A',
      capacity: 30,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    }

    // WHEN
    const result = await createClassPeriod(
      input,
      classPeriodGateway as unknown as ClassPeriodGw,
      levelGateway as unknown as LevelGw,
      periodGateway as unknown as PeriodGw
    )

    // THEN
    expect(result).toBe('levelNotFound')
  })

  it('fails when period not found', async () => {
    // GIVEN
    periodGateway.periodToReturn = null
    const input = {
      schoolId,
      name: 'Class A',
      capacity: 30,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    }

    // WHEN
    const result = await createClassPeriod(
      input,
      classPeriodGateway as unknown as ClassPeriodGw,
      levelGateway as unknown as LevelGw,
      periodGateway as unknown as PeriodGw
    )

    // THEN
    expect(result).toBe('periodNotFound')
  })

  it('creates class period with valid data', async () => {
    // GIVEN
    const input = {
      schoolId,
      name: 'Class A',
      capacity: 30,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    }

    // WHEN
    const result = await createClassPeriod(
      input,
      classPeriodGateway as unknown as ClassPeriodGw,
      levelGateway as unknown as LevelGw,
      periodGateway as unknown as PeriodGw
    )

    // THEN
    expect(result).toHaveProperty('id', 'class-period-123')
  })

  it('calls gateway with correct schoolId and data', async () => {
    // GIVEN
    const input = {
      schoolId,
      name: 'Class B',
      capacity: 25,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    }

    // WHEN
    await createClassPeriod(
      input,
      classPeriodGateway as unknown as ClassPeriodGw,
      levelGateway as unknown as LevelGw,
      periodGateway as unknown as PeriodGw
    )

    // THEN
    expect(classPeriodGateway.createdSchoolId).toBe(schoolId)
    expect(classPeriodGateway.createdData).toMatchObject({
      name: 'Class B',
      capacity: 25,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    })
  })
})
