import { beforeEach, describe, expect, it } from 'vitest'
import { getConfig } from './get-config'

const SCHOOL_ID = 'school-1'

class ConfigGatewaySpy {
  configByNameMap: Record<string, { id: string; name: string; value: string; valueType: string }> =
    {}

  async get(_schoolId: string, name: string) {
    return this.configByNameMap[name] || null
  }

  async set() {
    return {} as never
  }

  async list() {
    return []
  }
}

describe('getConfig', () => {
  let gateway: ConfigGatewaySpy

  beforeEach(() => {
    gateway = new ConfigGatewaySpy()
    gateway.configByNameMap = {
      'app.timezone': {
        id: 'config-1',
        name: 'app.timezone',
        value: 'Europe/Paris',
        valueType: 'TEXT',
      },
      'enrollment.max-capacity': {
        id: 'config-2',
        name: 'enrollment.max-capacity',
        value: '50',
        valueType: 'NUMBER',
      },
      'debug-mode': { id: 'config-3', name: 'debug-mode', value: 'false', valueType: 'BOOLEAN' },
    }
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = { schoolId: SCHOOL_ID, name: '' }

    // WHEN
    const result = await getConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when name exceeds max length', async () => {
    // GIVEN
    const input = { schoolId: SCHOOL_ID, name: 'a'.repeat(251) }

    // WHEN
    const result = await getConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when config not found', async () => {
    // GIVEN
    const input = { schoolId: SCHOOL_ID, name: 'nonexistent.config' }

    // WHEN
    const result = await getConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('notFound')
  })

  it('retrieves text config', async () => {
    // GIVEN
    const input = { schoolId: SCHOOL_ID, name: 'app.timezone' }

    // WHEN
    const result = await getConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toMatchObject({
      name: 'app.timezone',
      value: 'Europe/Paris',
      valueType: 'TEXT',
    })
  })

  it('retrieves number config', async () => {
    // GIVEN
    const input = { schoolId: SCHOOL_ID, name: 'enrollment.max-capacity' }

    // WHEN
    const result = await getConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toMatchObject({
      name: 'enrollment.max-capacity',
      value: '50',
      valueType: 'NUMBER',
    })
  })

  it('retrieves boolean config', async () => {
    // GIVEN
    const input = { schoolId: SCHOOL_ID, name: 'debug-mode' }

    // WHEN
    const result = await getConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toMatchObject({
      name: 'debug-mode',
      value: 'false',
      valueType: 'BOOLEAN',
    })
  })
})
