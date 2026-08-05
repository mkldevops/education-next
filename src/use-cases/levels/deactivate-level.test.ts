import { beforeEach, describe, expect, it } from 'vitest'
import { deactivateLevel } from './deactivate-level'
import { renameLevel } from './rename-level'

class LevelGatewaySpy {
  levelsByIdMap: Record<string, { id: string; name: string }> = {}
  classPeriodCount = 0
  deactivateCalls: string[] = []
  updateCalls: Array<{ id: string; data: { name?: string } }> = []

  async findById(id: string) {
    return this.levelsByIdMap[id] || null
  }

  async countClassPeriods() {
    return this.classPeriodCount
  }

  async deactivate(id: string) {
    this.deactivateCalls.push(id)
    return [] as never
  }

  async update(id: string, data: { name?: string }) {
    this.updateCalls.push({ id, data })
    return {} as never
  }
}

const levelId = '123e4567-e89b-12d3-a456-426614174001'

describe('deactivateLevel', () => {
  let gateway: LevelGatewaySpy

  beforeEach(() => {
    gateway = new LevelGatewaySpy()
    gateway.levelsByIdMap = { [levelId]: { id: levelId, name: 'CP' } }
  })

  it('rejects an invalid id', async () => {
    expect(await deactivateLevel({ id: 'nope' }, gateway as never)).toBe('validationError')
  })

  it('fails when the level does not exist', async () => {
    expect(
      await deactivateLevel({ id: '123e4567-e89b-12d3-a456-426614174099' }, gateway as never)
    ).toBe('notFound')
  })

  it('refuses to deactivate a level still used by classes', async () => {
    gateway.classPeriodCount = 2

    expect(await deactivateLevel({ id: levelId }, gateway as never)).toBe('levelInUse')
    expect(gateway.deactivateCalls).toEqual([])
  })

  it('deactivates an unused level', async () => {
    expect(await deactivateLevel({ id: levelId }, gateway as never)).toBe('OK')
    expect(gateway.deactivateCalls).toEqual([levelId])
  })
})

describe('renameLevel', () => {
  let gateway: LevelGatewaySpy

  beforeEach(() => {
    gateway = new LevelGatewaySpy()
    gateway.levelsByIdMap = { [levelId]: { id: levelId, name: 'CP' } }
  })

  it('rejects an empty name', async () => {
    expect(await renameLevel({ id: levelId, name: '' }, gateway as never)).toBe('validationError')
  })

  it('fails when the level does not exist', async () => {
    expect(
      await renameLevel(
        { id: '123e4567-e89b-12d3-a456-426614174099', name: 'CE1' },
        gateway as never
      )
    ).toBe('notFound')
  })

  it('renames an existing level', async () => {
    expect(await renameLevel({ id: levelId, name: 'CP bis' }, gateway as never)).toBe('OK')
    expect(gateway.updateCalls).toEqual([{ id: levelId, data: { name: 'CP bis' } }])
  })
})
