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

  beforeEach(() => {
    gateway = new LevelGatewaySpy()
    gateway.levelsByIdMap = {
      'level-1': { id: 'level-1', nextLevelId: null },
      'level-2': { id: 'level-2', nextLevelId: null },
      'level-3': { id: 'level-3', nextLevelId: null },
    }
    gateway.levelsList = [
      { id: 'level-1', nextLevelId: null },
      { id: 'level-2', nextLevelId: null },
      { id: 'level-3', nextLevelId: null },
    ]
  })

  it('fails validation when id is invalid', async () => {
    // GIVEN
    const input = { id: 'invalid-uuid', nextLevelId: null }

    // WHEN
    const result = await setNextLevel(input, gateway)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when level not found', async () => {
    // GIVEN
    const input = { id: '123e4567-e89b-12d3-a456-426614174000', nextLevelId: null }

    // WHEN
    const result = await setNextLevel(input, gateway)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when next level not found', async () => {
    // GIVEN
    const input = { id: 'level-1', nextLevelId: '123e4567-e89b-12d3-a456-426614174999' }

    // WHEN
    const result = await setNextLevel(input, gateway)

    // THEN
    expect(result).toBe('notFound')
  })

  it('fails when creating circular reference to self', async () => {
    // GIVEN
    const input = { id: 'level-1', nextLevelId: 'level-1' }

    // WHEN
    const result = await setNextLevel(input, gateway)

    // THEN
    expect(result).toBe('circularReference')
  })

  it('fails when creating circular reference through chain', async () => {
    // GIVEN
    gateway.levelsList = [
      { id: 'level-1', nextLevelId: 'level-2' },
      { id: 'level-2', nextLevelId: 'level-3' },
      { id: 'level-3', nextLevelId: null },
    ]
    const input = { id: 'level-3', nextLevelId: 'level-1' }

    // WHEN
    const result = await setNextLevel(input, gateway)

    // THEN
    expect(result).toBe('circularReference')
  })

  it('sets next level successfully', async () => {
    // GIVEN
    const input = { id: 'level-1', nextLevelId: 'level-2' }

    // WHEN
    const result = await setNextLevel(input, gateway)

    // THEN
    expect(result).toBe('OK')
  })

  it('allows clearing next level by setting to null', async () => {
    // GIVEN
    gateway.levelsByIdMap['level-1'].nextLevelId = 'level-2'
    const input = { id: 'level-1', nextLevelId: null }

    // WHEN
    const result = await setNextLevel(input, gateway)

    // THEN
    expect(result).toBe('OK')
  })

  it('calls gateway with correct id and nextLevelId', async () => {
    // GIVEN
    const input = { id: 'level-1', nextLevelId: 'level-2' }

    // WHEN
    await setNextLevel(input, gateway)

    // THEN
    expect(gateway.setNextLevelCalls).toContainEqual({
      id: 'level-1',
      nextLevelId: 'level-2',
    })
  })

  it('calls gateway with null when clearing next level', async () => {
    // GIVEN
    const input = { id: 'level-2', nextLevelId: null }

    // WHEN
    await setNextLevel(input, gateway)

    // THEN
    expect(gateway.setNextLevelCalls).toContainEqual({
      id: 'level-2',
      nextLevelId: null,
    })
  })
})
