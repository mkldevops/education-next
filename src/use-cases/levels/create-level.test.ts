import { beforeEach, describe, expect, it } from 'vitest'
import type { levelGateway } from '@/gateways/level-gateway'
import { createLevel } from './create-level'

class LevelGatewaySpy {
  createdSchoolId: string | null = null
  createdData: unknown = null
  levelToReturn: unknown = null
  homonym: { id: string } | null = null
  createError: unknown = null

  async findActiveByName() {
    return this.homonym
  }

  async create(schoolId: string, data: unknown) {
    if (this.createError) throw this.createError
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

  it('refuses a name already used by an active level of the school', async () => {
    // GIVEN
    gateway.homonym = { id: 'level-other' }

    // WHEN
    const result = await createLevel({ schoolId, name: 'CP' }, asGateway(gateway))

    // THEN
    expect(result).toBe('nameTaken')
    expect(gateway.createdData).toBeNull()
  })

  it('maps a concurrent unique violation to nameTaken', async () => {
    // GIVEN
    gateway.createError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })

    // WHEN
    const result = await createLevel({ schoolId, name: 'CP' }, asGateway(gateway))

    // THEN
    expect(result).toBe('nameTaken')
  })

  it('rethrows other gateway errors', async () => {
    // GIVEN
    gateway.createError = new Error('connection lost')

    // WHEN / THEN
    await expect(createLevel({ schoolId, name: 'CP' }, asGateway(gateway))).rejects.toThrow(
      'connection lost'
    )
  })
})
