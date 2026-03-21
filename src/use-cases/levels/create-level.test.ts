import { beforeEach, describe, expect, it } from 'vitest'
import { createLevel } from './create-level'

class LevelGatewaySpy {
  createdData: unknown = null
  levelToReturn: unknown = null

  async create(data: unknown) {
    this.createdData = data
    return (this.levelToReturn || { id: 'level-123', ...(data as object) }) as unknown
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
    const result = await createLevel(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when name exceeds max length', async () => {
    // GIVEN
    const input = { name: 'a'.repeat(251) }

    // WHEN
    const result = await createLevel(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('creates level with valid name', async () => {
    // GIVEN
    const input = { name: 'Grade 1' }

    // WHEN
    const result = await createLevel(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('id', 'level-123')
  })

  it('calls gateway with correct data', async () => {
    // GIVEN
    const input = { name: 'Grade 2' }

    // WHEN
    await createLevel(input, gateway as unknown as any)

    // THEN
    expect(gateway.createdData).toMatchObject({ name: 'Grade 2' })
  })
})
