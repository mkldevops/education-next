// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/use-cases/platform-settings/is-ai-assistant-enabled', () => ({
  isAiAssistantEnabled: vi.fn(),
}))
vi.mock('@/use-cases/platform-settings/openrouter-api-key', () => ({
  readOpenRouterApiKey: vi.fn(),
}))
vi.mock('@/use-cases/ai-assistant/sanitize-image', () => ({ sanitizeImage: vi.fn() }))

const { extractFormerStudents } = await import('./extract-former-students')
type Deps = Parameters<typeof extractFormerStudents>[1]

const text = (value: string) => new TextEncoder().encode(value)
const pdf = text('%PDF-1.7\n...')
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const xlsx = new Uint8Array(readFileSync(join(__dirname, '__fixtures__', 'former-students.xlsx')))

const student = (lastname: string, firstname: string, extra: Record<string, unknown> = {}) => ({
  lastname: { value: lastname, uncertain: false },
  firstname: { value: firstname, uncertain: false },
  birthday: { value: null, uncertain: false },
  className: { value: 'CM2', uncertain: false },
  departureYear: { value: 2023, uncertain: false },
  ...extra,
})

let deps: Deps & Required<Omit<Deps, 'readSpreadsheet'>>

beforeEach(() => {
  deps = {
    extract: vi.fn(async () => ({
      status: 'OK' as const,
      output: { students: [student('Durand', 'Léa')] },
    })),
    isEnabled: vi.fn(async () => true),
    readApiKey: vi.fn(async () => 'sk-test'),
    isRateLimited: vi.fn(() => false),
    sanitizeImage: vi.fn(async () => ({
      status: 'OK' as const,
      dataUrl: 'data:image/webp;base64,AAAA',
      width: 10,
      height: 10,
    })),
  }
})

const run = (
  files: { name: string; type: string; bytes: Uint8Array }[],
  extra: Partial<Deps> = {}
) => extractFormerStudents({ schoolId: 'school-a', userId: 'user-1', files }, { ...deps, ...extra })

const csvFile = { name: 'liste.csv', type: 'text/csv', bytes: text('Nom;Prénom\nDurand;Léa') }

describe('extractFormerStudents guards', () => {
  it('refuses when the AI is disabled', async () => {
    expect(await run([csvFile], { isEnabled: async () => false })).toEqual({
      status: 'aiDisabled',
    })
    expect(deps.extract).not.toHaveBeenCalled()
  })

  it('refuses without an OpenRouter key', async () => {
    expect(await run([csvFile], { readApiKey: async () => null })).toEqual({
      status: 'aiNotConfigured',
    })
  })

  it('rate-limits per admin and school', async () => {
    const isRateLimited = vi.fn(() => true)
    expect(await run([csvFile], { isRateLimited })).toEqual({ status: 'tooManyRequests' })
    expect(isRateLimited).toHaveBeenCalledWith('user-1:school-a')
  })

  it('refuses more than four files and an empty upload', async () => {
    expect(await run(Array.from({ length: 5 }, () => csvFile))).toEqual({
      status: 'tooManyFiles',
    })
    expect(await run([])).toEqual({ status: 'nothingFound' })
  })

  it('refuses a file over 6 MB and a total over 10 MB', async () => {
    const big = { ...csvFile, bytes: new Uint8Array(6 * 1024 * 1024 + 1) }
    expect(await run([big])).toEqual({ status: 'fileTooLarge' })
    const four = { ...csvFile, bytes: new Uint8Array(3 * 1024 * 1024) }
    expect(await run([four, four, four, four])).toEqual({ status: 'fileTooLarge' })
  })

  it('refuses a text over the character cap', async () => {
    const long = { ...csvFile, bytes: text('a'.repeat(200_001)) }
    expect(await run([long])).toEqual({ status: 'fileTooLarge' })
  })
})

describe('extractFormerStudents routing', () => {
  it('sends a CSV as text', async () => {
    await run([csvFile])
    expect(deps.extract).toHaveBeenCalledWith({
      apiKey: 'sk-test',
      sources: [{ kind: 'text', name: 'liste.csv', text: 'Nom;Prénom\nDurand;Léa' }],
    })
  })

  it('decodes a Windows-1252 TXT export', async () => {
    const latin = new Uint8Array([0x4c, 0xe9, 0x61])
    await run([{ name: 'liste.txt', type: '', bytes: latin }])
    expect(deps.extract).toHaveBeenCalledWith(
      expect.objectContaining({ sources: [{ kind: 'text', name: 'liste.txt', text: 'Léa' }] })
    )
  })

  it('refuses a binary file declared as text', async () => {
    const binary = { name: 'liste.csv', type: 'text/csv', bytes: new Uint8Array([0x41, 0, 0x42]) }
    expect(await run([binary])).toEqual({ status: 'forbiddenFile' })
  })

  it('converts an xlsx workbook to CSV text', async () => {
    await run([{ name: 'anciens.xlsx', type: '', bytes: xlsx }])
    expect(deps.extract).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: [
          {
            kind: 'text',
            name: 'anciens.xlsx',
            text: '# Anciens\nNom;Prénom;Classe;Année\nDurand;Léa;CM2;2023\nMartin;Hugo;CE1;2022',
          },
        ],
      })
    )
  })

  it('refuses a zip archive that is not a workbook', async () => {
    expect(await run([{ name: 'photos.zip', type: 'application/zip', bytes: xlsx }])).toEqual({
      status: 'forbiddenFile',
    })
  })

  it('maps an unreadable workbook to unreadable', async () => {
    const readSpreadsheet = vi.fn(async () => ({ status: 'unreadable' as const }))
    expect(await run([{ name: 'a.xlsx', type: '', bytes: xlsx }], { readSpreadsheet })).toEqual({
      status: 'unreadable',
    })
  })

  it('sends a PDF recognised by its signature, whatever its declared type', async () => {
    await run([{ name: 'liste.pdf', type: 'image/png', bytes: pdf }])
    expect(deps.extract).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: [{ kind: 'pdf', name: 'liste.pdf', base64: Buffer.from(pdf).toString('base64') }],
      })
    )
  })

  it('sanitizes an image before sending it', async () => {
    await run([{ name: 'photo.png', type: 'image/png', bytes: png }])
    expect(deps.sanitizeImage).toHaveBeenCalledWith(png)
    expect(deps.extract).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: [{ kind: 'image', name: 'photo.png', dataUrl: 'data:image/webp;base64,AAAA' }],
      })
    )
  })

  it.each([
    ['forbiddenFile', 'forbiddenFile'],
    ['unreadableImage', 'unreadable'],
    ['imageTooLarge', 'fileTooLarge'],
  ] as const)('maps the image refusal %s to %s', async (refusal, expected) => {
    const sanitizeImage = vi.fn(async () => ({ status: refusal }))
    expect(
      await run([{ name: 'x.png', type: 'image/png', bytes: png }], { sanitizeImage })
    ).toEqual({ status: expected })
  })
})

describe('extractFormerStudents output', () => {
  it('passes provider failures through', async () => {
    const extract = vi.fn(async () => ({ status: 'providerError' as const }))
    expect(await run([csvFile], { extract })).toEqual({ status: 'providerError' })
    const unreadable = vi.fn(async () => ({ status: 'unreadable' as const }))
    expect(await run([csvFile], { extract: unreadable })).toEqual({ status: 'unreadable' })
  })

  it('returns unreadable when the output is not a student list', async () => {
    const extract = vi.fn(async () => ({ status: 'OK' as const, output: { pupils: [] } }))
    expect(await run([csvFile], { extract })).toEqual({ status: 'unreadable' })
  })

  it('returns nothingFound when no student was read', async () => {
    const extract = vi.fn(async () => ({
      status: 'OK' as const,
      output: { students: [student('', ''), 'garbage'] },
    }))
    const emptied = vi.fn(async () => ({
      status: 'OK' as const,
      output: {
        students: [
          {
            ...student('', ''),
            className: { value: null, uncertain: false },
            departureYear: { value: null, uncertain: false },
          },
        ],
      },
    }))
    expect((await run([csvFile], { extract })).status).toBe('OK')
    expect(await run([csvFile], { extract: emptied })).toEqual({ status: 'nothingFound' })
  })

  it('keeps uncertain flags and normalizes values to editable strings', async () => {
    const extract = vi.fn(async () => ({
      status: 'OK' as const,
      output: {
        students: [
          student(' Durand ', 'Léa', {
            birthday: { value: '2012-03-04', uncertain: true },
            departureYear: { value: 2023, uncertain: true },
          }),
        ],
      },
    }))
    const result = await run([csvFile], { extract })
    if (result.status !== 'OK') throw new Error(result.status)
    expect(result.rows).toEqual([
      {
        id: expect.any(String),
        lastname: 'Durand',
        firstname: 'Léa',
        birthday: '2012-03-04',
        className: 'CM2',
        departureYear: '2023',
        included: true,
        uncertain: ['birthday', 'departureYear'],
      },
    ])
  })

  it('caps the reading at 500 rows', async () => {
    const extract = vi.fn(async () => ({
      status: 'OK' as const,
      output: { students: Array.from({ length: 502 }, (_, i) => student(`Nom${i}`, 'Léa')) },
    }))
    const result = await run([csvFile], { extract })
    if (result.status !== 'OK') throw new Error(result.status)
    expect(result.rows).toHaveLength(500)
    expect(result.truncated).toBe(true)
  })
})
