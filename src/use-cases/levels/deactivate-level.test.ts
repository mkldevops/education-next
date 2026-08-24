import { beforeEach, describe, expect, it } from 'vitest'
import type { levelGateway } from '@/gateways/level-gateway'
import { deactivateLevel } from './deactivate-level'
import { renameLevel } from './rename-level'

class LevelGatewaySpy {
  levelsByIdMap: Record<string, { id: string; name: string }> = {}
  classPeriodCount = 0
  deactivateCalls: string[] = []
  updateCalls: Array<{ id: string; data: { name?: string } }> = []

  async findById(_schoolId: string, id: string) {
    return this.levelsByIdMap[id] || null
  }

  async countClassPeriods() {
    return this.classPeriodCount
  }

  async deactivate(_schoolId: string, id: string) {
    this.deactivateCalls.push(id)
    return [] as never
  }

  async update(_schoolId: string, id: string, data: { name?: string }) {
    this.updateCalls.push({ id, data })
    return {} as never
  }
}

function asGateway(gateway: LevelGatewaySpy) {
  return gateway as unknown as typeof levelGateway
}

const schoolId = 'school-1'
const levelId = '123e4567-e89b-12d3-a456-426614174001'

describe('deactivateLevel', () => {
  let gateway: LevelGatewaySpy

  beforeEach(() => {
    gateway = new LevelGatewaySpy()
    gateway.levelsByIdMap = { [levelId]: { id: levelId, name: 'CP' } }
  })

  it('rejects an invalid id', async () => {
    expect(await deactivateLevel({ schoolId, id: 'nope' }, asGateway(gateway))).toBe(
      'validationError'
    )
  })

  it('fails when the level does not exist', async () => {
    expect(
      await deactivateLevel(
        { schoolId, id: '123e4567-e89b-12d3-a456-426614174099' },
        asGateway(gateway)
      )
    ).toBe('notFound')
  })

  it('refuses to deactivate a level still used by classes', async () => {
    gateway.classPeriodCount = 2

    expect(await deactivateLevel({ schoolId, id: levelId }, asGateway(gateway))).toBe('levelInUse')
    expect(gateway.deactivateCalls).toEqual([])
  })

  it('deactivates an unused level', async () => {
    expect(await deactivateLevel({ schoolId, id: levelId }, asGateway(gateway))).toBe('OK')
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
    expect(await renameLevel({ schoolId, id: levelId, name: '' }, asGateway(gateway))).toBe(
      'validationError'
    )
  })

  it('fails when the level does not exist', async () => {
    expect(
      await renameLevel(
        { schoolId, id: '123e4567-e89b-12d3-a456-426614174099', name: 'CE1' },
        asGateway(gateway)
      )
    ).toBe('notFound')
  })

  it('renames an existing level', async () => {
    expect(await renameLevel({ schoolId, id: levelId, name: 'CP bis' }, asGateway(gateway))).toBe(
      'OK'
    )
    expect(gateway.updateCalls).toEqual([{ id: levelId, data: { name: 'CP bis' } }])
  })
})
