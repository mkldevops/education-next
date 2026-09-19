import { beforeEach, describe, expect, it } from 'vitest'
import type { levelGateway } from '@/gateways/level-gateway'
import { renameLevel } from './rename-level'

const schoolId = 'school-1'
const levelId = '11111111-1111-4111-8111-111111111111'

class LevelGatewaySpy {
  level: { id: string } | null = { id: levelId }
  homonym: { id: string } | null = null
  updateError: unknown = null
  updatedName: string | null = null

  async findById() {
    return this.level
  }

  async findActiveByName() {
    return this.homonym
  }

  async update(_schoolId: string, _id: string, data: { name?: string }) {
    if (this.updateError) throw this.updateError
    this.updatedName = data.name ?? null
    return {}
  }
}

function asGateway(gateway: LevelGatewaySpy) {
  return gateway as unknown as typeof levelGateway
}

describe('renameLevel', () => {
  let gateway: LevelGatewaySpy

  beforeEach(() => {
    gateway = new LevelGatewaySpy()
  })

  const run = (name: string) => renameLevel({ schoolId, id: levelId, name }, asGateway(gateway))

  it('renames the level', async () => {
    // WHEN
    const result = await run('CE1')

    // THEN
    expect(result).toBe('OK')
    expect(gateway.updatedName).toBe('CE1')
  })

  it('refuses a name carried by another active level', async () => {
    // GIVEN
    gateway.homonym = { id: '22222222-2222-4222-8222-222222222222' }

    // WHEN
    const result = await run('CE1')

    // THEN
    expect(result).toBe('nameTaken')
    expect(gateway.updatedName).toBeNull()
  })

  it('accepts the name the level already carries', async () => {
    // GIVEN
    gateway.homonym = { id: levelId }

    // WHEN
    const result = await run('CE1')

    // THEN
    expect(result).toBe('OK')
  })

  it('maps a concurrent unique violation to nameTaken', async () => {
    // GIVEN
    gateway.updateError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })

    // WHEN
    const result = await run('CE1')

    // THEN
    expect(result).toBe('nameTaken')
  })
})
