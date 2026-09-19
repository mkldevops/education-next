import { beforeEach, describe, expect, it } from 'vitest'
import { setConfig } from './set-config'

type ConfigGw = Parameters<typeof setConfig>[1]
type Input = Parameters<typeof setConfig>[0]

const SCHOOL_ID = 'school-1'

class ConfigGatewaySpy {
  setData: unknown = null
  configToReturn: unknown = null

  async set(_schoolId: string, data: unknown) {
    this.setData = data
    return (this.configToReturn || { id: 'config-123', ...(data as object) }) as never
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

  const run = (input: Input) => setConfig(input, gateway as unknown as ConfigGw)

  it('refuses a name outside the known school settings', async () => {
    // WHEN
    const result = await run({
      schoolId: SCHOOL_ID,
      name: 'favicon_url' as never,
      value: 'true',
    })

    // THEN
    expect(result).toBe('validationError')
    expect(gateway.setData).toBeNull()
  })

  it('fails validation when name is empty', async () => {
    // WHEN
    const result = await run({ schoolId: SCHOOL_ID, name: '' as never, value: 'test' })

    // THEN
    expect(result).toBe('validationError')
  })

  it('fails when a NUMBER setting has a non-numeric value', async () => {
    // WHEN
    const result = await run({
      schoolId: SCHOOL_ID,
      name: 'max_students_per_class',
      value: 'not-a-number',
    })

    // THEN
    expect(result).toBe('invalidNumber')
  })

  it('fails when a BOOLEAN setting has an invalid value', async () => {
    // WHEN
    const result = await run({
      schoolId: SCHOOL_ID,
      name: 'teacher_expenses_enabled',
      value: 'yes',
    })

    // THEN
    expect(result).toBe('invalidConfigValue')
  })

  it('stores the value type declared for the key, not one chosen by the caller', async () => {
    // WHEN
    await run({
      schoolId: SCHOOL_ID,
      name: 'max_students_per_class',
      value: '25',
      valueType: 'TEXT',
    } as Input)

    // THEN
    expect(gateway.setData).toEqual({
      name: 'max_students_per_class',
      value: '25',
      valueType: 'NUMBER',
    })
  })

  it('sets a TEXT setting', async () => {
    // WHEN
    const result = await run({
      schoolId: SCHOOL_ID,
      name: 'logo_url',
      value: 'https://example.com/logo.png',
    })

    // THEN
    expect(result).toHaveProperty('valueType', 'TEXT')
  })

  it('refuses an unknown class schedule visibility', async () => {
    const result = await run({
      schoolId: SCHOOL_ID,
      name: 'class_schedule_visibility',
      value: 'FRIENDS_ONLY',
    })

    expect(result).toBe('invalidConfigValue')
    expect(gateway.setData).toBeNull()
  })

  it.each(['-5', '0', '3.5', '', ' ', '1e2', '+3'])('refuses %j as a class size', async (value) => {
    // WHEN
    const result = await run({ schoolId: SCHOOL_ID, name: 'max_students_per_class', value })

    // THEN
    expect(result).toBe('invalidNumber')
    expect(gateway.setData).toBeNull()
  })

  it.each(['1', '25'])('sets the class size to %s', async (value) => {
    // WHEN
    const result = await run({ schoolId: SCHOOL_ID, name: 'max_students_per_class', value })

    // THEN
    expect(result).toMatchObject({ value, valueType: 'NUMBER' })
  })

  it.each(['true', 'false'])('sets a BOOLEAN setting to %s', async (value) => {
    // WHEN
    const result = await run({ schoolId: SCHOOL_ID, name: 'automatic_promotion', value })

    // THEN
    expect(result).toMatchObject({ value, valueType: 'BOOLEAN' })
  })

  it('refuses a color that escapes the style rule', async () => {
    // WHEN
    const result = await run({
      schoolId: SCHOOL_ID,
      name: 'theme_primary',
      value: '#fff; } body { display: none } :root {',
    })

    // THEN
    expect(result).toBe('invalidConfigValue')
    expect(gateway.setData).toBeNull()
  })

  it('accepts an hexadecimal color on a derived theme token', async () => {
    // WHEN
    await run({ schoolId: SCHOOL_ID, name: 'theme_primary_hover', value: '#30595b' })

    // THEN
    expect(gateway.setData).toMatchObject({ value: '#30595b', valueType: 'COLOR' })
  })
})
