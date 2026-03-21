import { beforeEach, describe, expect, it } from 'vitest'
import { setNextLevel } from './set-next-level'

class LevelGatewaySpy {
  levelsByIdMap: Record<string, { id: string; nextLevelId: string | null }> = {}
  levelsList: Array<{ id: string; nextLevelId: string | null }> = []
  setNextLevelCalls: Array<{ id: string; nextLevelId: string | null }> = []

  async findById(id: string) {
    return this.levelsByIdMap[id] || null
  }

  async list() {
    return this.levelsList
  }

  async setNextLevel(id: string, nextLevelId: string | null) {
    this.setNextLevelCalls.push({ id, nextLevelId })
  }

  async create() {
    return {} as never
  }

  async update() {
    return {} as never
  }
}

describe('setNextLevel', () => {
  let gateway: LevelGatewaySpy
  const levelId1 = '123e4567-e89b-12d3-a456-426614174001'
  const levelId2 = '123e4567-e89b-12d3-a456-426614174002'
  const levelId3 = '123e4567-e89b-12d3-a456-426614174003'

  beforeEach(() => {
    gateway = new LevelGatewaySpy()
    gateway.levelsByIdMap = {
      [levelId1]: { id: levelId1, nextLevelId: null },
      [levelId2]: { id: levelId2, nextLevelId: null },
      [levelId3]: { id: levelId3, nextLevelId: null },
    }
    gateway.levelsList = [
      { id: levelId1, nextLevelId: null },
      { id: levelId2, nextLevelId: null },
      { id: levelId3, nextLevelId: null },
    ]
  })

  it('fails validation when id is invalid', async () => {
    // GIVEN
    const input = { id: 'invalid-uuid', nextLevelId: null }

    // WHEN
    const result = await setNextLevel(input, gateway as unknown)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when level not found', async () => {
    // GIVEN
    const input = { id: '123e4567-e89b-12d3-a456-426614174000', nextLevelId: null }

    // WHEN
    const result = await setNextLevel(input, gateway as unknown)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when next level not found', async () => {
    // GIVEN
    const input = { id: levelId1, nextLevelId: '123e4567-e89b-12d3-a456-426614174999' }

    // WHEN
    const result = await setNextLevel(input, gateway as unknown)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when creating circular reference to self', async () => {
    // GIVEN
    const input = { id: levelId1, nextLevelId: levelId1 }

    // WHEN
    const result = await setNextLevel(input, gateway as unknown)

    // THEN
    expect(result).toBe('circularReference')
  })

  it('fails when creating circular reference through chain', async () => {
    // GIVEN
    gateway.levelsList = [
      { id: levelId1, nextLevelId: levelId2 },
      { id: levelId2, nextLevelId: levelId3 },
      { id: levelId3, nextLevelId: null },
    ]
    const input = { id: levelId3, nextLevelId: levelId1 }

    // WHEN
    const result = await setNextLevel(input, gateway as unknown)

    // THEN
    expect(result).toBe('circularReference')
  })

  it('sets next level successfully', async () => {
    // GIVEN
    const input = { id: levelId1, nextLevelId: levelId2 }

    // WHEN
    const result = await setNextLevel(input, gateway as unknown)

    // THEN
    expect(result).toBe('OK')
  })

  it('allows clearing next level by setting to null', async () => {
    // GIVEN
    gateway.levelsByIdMap[levelId1].nextLevelId = levelId2
    const input = { id: levelId1, nextLevelId: null }

    // WHEN
    const result = await setNextLevel(input, gateway as unknown)

    // THEN
    expect(result).toBe('OK')
  })

  it('calls gateway with correct id and nextLevelId', async () => {
    // GIVEN
    const input = { id: levelId1, nextLevelId: levelId2 }

    // WHEN
    await setNextLevel(input, gateway as unknown)

    // THEN
    expect(gateway.setNextLevelCalls).toContainEqual({
      id: levelId1,
      nextLevelId: levelId2,
    })
  })

  it('calls gateway with null when clearing next level', async () => {
    // GIVEN
    const input = { id: levelId2, nextLevelId: null }

    // WHEN
    await setNextLevel(input, gateway as unknown)

    // THEN
    expect(gateway.setNextLevelCalls).toContainEqual({
      id: levelId2,
      nextLevelId: null,
    })
  })
})
