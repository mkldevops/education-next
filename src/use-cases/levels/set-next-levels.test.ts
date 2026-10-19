import { beforeEach, describe, expect, it } from 'vitest'
import type { levelGateway } from '@/gateways/level-gateway'
import { setNextLevels } from './set-next-levels'

class LevelGatewaySpy {
  levelIds = new Set<string>()
  edges: Array<{ levelId: string; nextLevelId: string }> = []
  setNextLevelsCalls: Array<{ id: string; nextLevelIds: string[] }> = []

  async findById(_schoolId: string, id: string) {
    return this.levelIds.has(id) ? { id } : null
  }

  async findActiveByIds(_schoolId: string, ids: string[]) {
    return ids.filter((id) => this.levelIds.has(id)).map((id) => ({ id }))
  }

  async listProgression() {
    return this.edges
  }

  async setNextLevels(_schoolId: string, id: string, nextLevelIds: string[]) {
    this.setNextLevelsCalls.push({ id, nextLevelIds })
  }
}

function asGateway(gateway: LevelGatewaySpy) {
  return gateway as unknown as typeof levelGateway
}

const schoolId = 'school-1'

describe('setNextLevels', () => {
  let gateway: LevelGatewaySpy
  const levelId1 = '123e4567-e89b-12d3-a456-426614174001'
  const levelId2 = '123e4567-e89b-12d3-a456-426614174002'
  const levelId3 = '123e4567-e89b-12d3-a456-426614174003'

  beforeEach(() => {
    gateway = new LevelGatewaySpy()
    gateway.levelIds = new Set([levelId1, levelId2, levelId3])
  })

  it('fails validation when id is invalid', async () => {
    const result = await setNextLevels(
      { schoolId, id: 'invalid-uuid', nextLevelIds: [] },
      asGateway(gateway)
    )

    expect(result).toBe('validationError')
  })

  it('fails when level not found', async () => {
    const result = await setNextLevels(
      { schoolId, id: '123e4567-e89b-12d3-a456-426614174000', nextLevelIds: [] },
      asGateway(gateway)
    )

    expect(result).toBe('notFound')
  })

  it('fails when one of the next levels is missing or belongs to another school', async () => {
    gateway.levelIds.delete(levelId3)

    const result = await setNextLevels(
      { schoolId, id: levelId1, nextLevelIds: [levelId2, levelId3] },
      asGateway(gateway)
    )

    expect(result).toBe('notFound')
    expect(gateway.setNextLevelsCalls).toEqual([])
  })

  it('refuses a level as its own next level', async () => {
    const result = await setNextLevels(
      { schoolId, id: levelId1, nextLevelIds: [levelId2, levelId1] },
      asGateway(gateway)
    )

    expect(result).toBe('circularReference')
  })

  it('refuses a link that closes a cycle through the progression', async () => {
    gateway.edges = [
      { levelId: levelId1, nextLevelId: levelId2 },
      { levelId: levelId2, nextLevelId: levelId3 },
    ]

    const result = await setNextLevels(
      { schoolId, id: levelId3, nextLevelIds: [levelId1] },
      asGateway(gateway)
    )

    expect(result).toBe('circularReference')
  })

  it('ignores the edges it replaces when looking for a cycle', async () => {
    gateway.edges = [
      { levelId: levelId1, nextLevelId: levelId2 },
      { levelId: levelId2, nextLevelId: levelId3 },
    ]

    const result = await setNextLevels(
      { schoolId, id: levelId2, nextLevelIds: [levelId1] },
      asGateway(gateway)
    )

    expect(result).toBe('circularReference')

    gateway.edges = [{ levelId: levelId2, nextLevelId: levelId1 }]
    const replaced = await setNextLevels(
      { schoolId, id: levelId2, nextLevelIds: [levelId3] },
      asGateway(gateway)
    )
    expect(replaced).toBe('OK')
  })

  it('sets several next levels, deduplicated', async () => {
    const result = await setNextLevels(
      { schoolId, id: levelId1, nextLevelIds: [levelId2, levelId3, levelId2] },
      asGateway(gateway)
    )

    expect(result).toBe('OK')
    expect(gateway.setNextLevelsCalls).toEqual([
      { id: levelId1, nextLevelIds: [levelId2, levelId3] },
    ])
  })

  it('lets two levels share the same next level', async () => {
    gateway.edges = [{ levelId: levelId1, nextLevelId: levelId3 }]

    const result = await setNextLevels(
      { schoolId, id: levelId2, nextLevelIds: [levelId3] },
      asGateway(gateway)
    )

    expect(result).toBe('OK')
  })

  it('clears the next levels with an empty list', async () => {
    const result = await setNextLevels(
      { schoolId, id: levelId2, nextLevelIds: [] },
      asGateway(gateway)
    )

    expect(result).toBe('OK')
    expect(gateway.setNextLevelsCalls).toEqual([{ id: levelId2, nextLevelIds: [] }])
  })
})
