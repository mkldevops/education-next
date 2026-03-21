import { beforeEach, describe, expect, it } from 'vitest'
import { setConfig } from './set-config'

class ConfigGatewaySpy {
  setData: unknown = null
  configToReturn: unknown = null

  async set(data: unknown) {
    this.setData = data
    return (this.configToReturn || { id: 'config-123', ...(data as object) }) as unknown as any
  }

  async get() {
    return null
  }

  async list() {
    return []
  }
}

describe('setConfig', () => {
  let gateway: ConfigGatewaySpy

  beforeEach(() => {
    gateway = new ConfigGatewaySpy()
  })

  it('fails validation when name is empty', async () => {
    // GIVEN
    const input = { name: '', value: 'test', valueType: 'TEXT' as const }

    // WHEN
    const result = await setConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails validation when value type is invalid', async () => {
    // GIVEN
    const input = { name: 'test.config', value: 'test', valueType: 'INVALID' as unknown as any }

    // WHEN
    const result = await setConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when NUMBER type has non-numeric value', async () => {
    // GIVEN
    const input = { name: 'max.users', value: 'not-a-number', valueType: 'NUMBER' as const }

    // WHEN
    const result = await setConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('invalidConfigValue')
  })

  it('fails when BOOLEAN type has invalid value', async () => {
    // GIVEN
    const input = { name: 'enable.feature', value: 'yes', valueType: 'BOOLEAN' as const }

    // WHEN
    const result = await setConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toBe('invalidConfigValue')
  })

  it('sets TEXT config', async () => {
    // GIVEN
    const input = { name: 'app.name', value: 'Education Next', valueType: 'TEXT' as const }

    // WHEN
    const result = await setConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('name', 'app.name')
  })

  it('sets NUMBER config with integer', async () => {
    // GIVEN
    const input = { name: 'max.users', value: '100', valueType: 'NUMBER' as const }

    // WHEN
    const result = await setConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('name', 'max.users')
  })

  it('sets NUMBER config with decimal', async () => {
    // GIVEN
    const input = { name: 'app.pi', value: '3.14159', valueType: 'NUMBER' as const }

    // WHEN
    const result = await setConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('name', 'app.pi')
  })

  it('sets BOOLEAN config to true', async () => {
    // GIVEN
    const input = { name: 'enable.notifications', value: 'true', valueType: 'BOOLEAN' as const }

    // WHEN
    const result = await setConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('name', 'enable.notifications')
  })

  it('sets BOOLEAN config to false', async () => {
    // GIVEN
    const input = { name: 'enable.notifications', value: 'false', valueType: 'BOOLEAN' as const }

    // WHEN
    const result = await setConfig(input, gateway as unknown as any)

    // THEN
    expect(result).toHaveProperty('name', 'enable.notifications')
  })

  it('calls gateway with correct data', async () => {
    // GIVEN
    const input = { name: 'test.setting', value: 'test-value', valueType: 'TEXT' as const }

    // WHEN
    await setConfig(input, gateway as unknown as any)

    // THEN
    expect(gateway.setData).toMatchObject({
      name: 'test.setting',
      value: 'test-value',
      valueType: 'TEXT',
    })
  })
})
