import { beforeEach, describe, expect, it } from 'vitest'
import { createLevel } from './create-level'

class LevelGatewaySpy {
  createdData: unknown = null
  levelToReturn: any = null

  async create(data: unknown) {
    this.createdData = data
    return this.levelToReturn || { id: 'level-123', ...data }
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

describe('createLevel', () => {
  let gateway: LevelGatewaySpy

  beforeEach(() => {
    gateway = new LevelGatewaySpy()
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = { name: '' }

    // WHEN
    const result = await createLevel(input, gateway)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when name exceeds max length', async () => {
    // GIVEN
    const input = { name: 'a'.repeat(251) }

    // WHEN
    const result = await createLevel(input, gateway)

    // THEN
    expect(result).toBe('validationError')
  })

  it('creates level with valid name', async () => {
    // GIVEN
    const input = { name: 'Grade 1' }

    // WHEN
    const result = await createLevel(input, gateway)

    // THEN
    expect(result).toHaveProperty('id', 'level-123')
  })

  it('creates level with optional nextLevelId', async () => {
    // GIVEN
    const input = { name: 'Grade 1', nextLevelId: '456e4567-e89b-12d3-a456-426614174000' }

    // WHEN
    const result = await createLevel(input, gateway)

    // THEN
    expect(result).toHaveProperty('nextLevelId', '456e4567-e89b-12d3-a456-426614174000')
  })

  it('calls gateway with correct data', async () => {
    // GIVEN
    const input = { name: 'Grade 2' }

    // WHEN
    await createLevel(input, gateway)

    // THEN
    expect(gateway.createdData).toMatchObject({ name: 'Grade 2' })
  })

  it('passes through nextLevelId if provided', async () => {
    // GIVEN
    const nextLevelId = '456e4567-e89b-12d3-a456-426614174000'
    const input = { name: 'Grade 3', nextLevelId }

    // WHEN
    await createLevel(input, gateway)

    // THEN
    expect(gateway.createdData).toMatchObject({ name: 'Grade 3', nextLevelId })
  })
})
