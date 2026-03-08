import { beforeEach, describe, expect, it } from 'vitest'
import { createClassPeriod } from './create-class-period'

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
  createdData: unknown = null
  classPeriodToReturn: any = null

  async create(data: unknown) {
    this.createdData = data
    return (this.classPeriodToReturn || { id: 'class-period-123', ...(data as object) }) as unknown as any
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
      name: '',
      capacity: 0,
      levelId: 'invalid-uuid',
      periodId: 'invalid-uuid',
    }

    // WHEN
    const result = await createClassPeriod(input, classPeriodGateway as unknown as any, levelGateway as unknown as any, periodGateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when level not found', async () => {
    // GIVEN
    levelGateway.levelToReturn = null
    const input = {
      name: 'Class A',
      capacity: 30,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    }

    // WHEN
    const result = await createClassPeriod(input, classPeriodGateway as unknown as any, levelGateway as unknown as any, periodGateway as unknown as any)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when period not found', async () => {
    // GIVEN
    periodGateway.periodToReturn = null
    const input = {
      name: 'Class A',
      capacity: 30,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    }

    // WHEN
    const result = await createClassPeriod(input, classPeriodGateway as unknown as any, levelGateway as unknown as any, periodGateway as unknown as any)

    // THEN
    expect(result).toBe('notFound')
  })

  it('creates class period with valid data', async () => {
    // GIVEN
    const input = {
      name: 'Class A',
      capacity: 30,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    }

    // WHEN
    const result = await createClassPeriod(input, classPeriodGateway as unknown as any, levelGateway as unknown as any, periodGateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', 'class-period-123')
  })

  it('calls gateway with correct data', async () => {
    // GIVEN
    const input = {
      name: 'Class B',
      capacity: 25,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    }

    // WHEN
    await createClassPeriod(input, classPeriodGateway as unknown as any, levelGateway as unknown as any, periodGateway as unknown as any)

    // THEN
    expect(classPeriodGateway.createdData).toMatchObject({
      name: 'Class B',
      capacity: 25,
      levelId: '123e4567-e89b-12d3-a456-426614174000',
      periodId: '123e4567-e89b-12d3-a456-426614174001',
    })
  })
})
