import { beforeEach, describe, expect, it } from 'vitest'
import { setThemeColors } from './set-theme-colors'

type ConfigGw = Parameters<typeof setThemeColors>[1]
type Input = Parameters<typeof setThemeColors>[0]

const SCHOOL_ID = 'school-1'

class ConfigGatewaySpy {
  setManyCalls: { schoolId: string; entries: unknown[] }[] = []

  async setMany(schoolId: string, entries: unknown[]) {
    this.setManyCalls.push({ schoolId, entries })
  }
}

describe('setThemeColors', () => {
  let gateway: ConfigGatewaySpy

  beforeEach(() => {
    gateway = new ConfigGatewaySpy()
  })

  const run = (input: Input) => setThemeColors(input, gateway as unknown as ConfigGw)

  it('writes every provided color in one call, in palette order', async () => {
    // WHEN
    const result = await run({
      schoolId: SCHOOL_ID,
      colors: { theme_background: '#ffffff', theme_primary: '#3c6e71' },
    })

    // THEN
    expect(result).toBe('OK')
    expect(gateway.setManyCalls).toEqual([
      {
        schoolId: SCHOOL_ID,
        entries: [
          { name: 'theme_primary', value: '#3c6e71', valueType: 'COLOR' },
          { name: 'theme_background', value: '#ffffff', valueType: 'COLOR' },
        ],
      },
    ])
  })

  it('writes nothing when one color escapes the style rule', async () => {
    // WHEN
    const result = await run({
      schoolId: SCHOOL_ID,
      colors: { theme_primary: '#3c6e71', theme_primary_hover: '#fff; } body { display: none' },
    })

    // THEN
    expect(result).toBe('invalidConfigValue')
    expect(gateway.setManyCalls).toEqual([])
  })

  it('refuses a key outside the theme colors', async () => {
    // WHEN
    const result = await run({
      schoolId: SCHOOL_ID,
      colors: { logo_url: '#3c6e71' } as never,
    })

    // THEN
    expect(result).toBe('validationError')
    expect(gateway.setManyCalls).toEqual([])
  })

  it('refuses an empty palette', async () => {
    // WHEN
    const result = await run({ schoolId: SCHOOL_ID, colors: {} })

    // THEN
    expect(result).toBe('validationError')
  })
})
