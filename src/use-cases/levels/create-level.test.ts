import { beforeEach, describe, expect, it } from 'vitest'
import type { levelGateway } from '@/gateways/level-gateway'
import { createLevel } from './create-level'

class LevelGatewaySpy {
  createdSchoolId: string | null = null
  createdData: unknown = null
  levelToReturn: unknown = null

  async create(schoolId: string, data: unknown) {
    this.createdSchoolId = schoolId
    this.createdData = data
    return (this.levelToReturn ?? { id: 'level-123', ...(data as object) }) as { id: string }
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

  async setNextLevel() {
    return {} as never
  }
}

function asGateway(gateway: LevelGatewaySpy) {
  return gateway as unknown as typeof levelGateway
}

const schoolId = 'school-1'

describe('createLevel', () => {
  let gateway: LevelGatewaySpy

  beforeEach(() => {
    gateway = new LevelGatewaySpy()
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = { schoolId, name: '' }

    // WHEN
    const result = await createLevel(input, asGateway(gateway))

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when name exceeds max length', async () => {
    // GIVEN
    const input = { schoolId, name: 'a'.repeat(251) }

    // WHEN
    const result = await createLevel(input, asGateway(gateway))

    // THEN
    expect(result).toBe('validationError')
  })

  it('creates level with valid name', async () => {
    // GIVEN
    const input = { schoolId, name: 'Grade 1' }

    // WHEN
    const result = await createLevel(input, asGateway(gateway))

    // THEN
    expect(result).toHaveProperty('id', 'level-123')
  })

  it('calls gateway with correct data', async () => {
    // GIVEN
    const input = { schoolId, name: 'Grade 2' }

    // WHEN
    await createLevel(input, asGateway(gateway))

    // THEN
    expect(gateway.createdData).toMatchObject({ name: 'Grade 2' })
  })
})
