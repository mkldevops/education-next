// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { declaredZipSize, readSpreadsheetAsCsv } from './read-spreadsheet'

const fixture = () =>
  new Uint8Array(readFileSync(join(__dirname, '__fixtures__', 'former-students.xlsx')))

/** Réécrit la taille décompressée annoncée de la première entrée du répertoire central. */
function inflateDeclaredSize(bytes: Uint8Array, size: number) {
  const copy = bytes.slice()
  const view = new DataView(copy.buffer)
  for (let offset = 0; offset < copy.length - 4; offset += 1) {
    if (view.getUint32(offset, true) === 0x02014b50) {
      view.setUint32(offset + 24, size, true)
      return copy
    }
  }
  throw new Error('no central directory entry')
}

describe('readSpreadsheetAsCsv', () => {
  it('converts every sheet to semicolon-separated text', async () => {
    const result = await readSpreadsheetAsCsv(fixture())
    expect(result).toEqual({
      status: 'OK',
      text: '# Anciens\nNom;Prénom;Classe;Année\nDurand;Léa;CM2;2023\nMartin;Hugo;CE1;2022',
    })
  })

  it('refuses an archive announcing a huge uncompressed size before parsing it', async () => {
    const bomb = inflateDeclaredSize(fixture(), 0xfffffff0)
    expect(await readSpreadsheetAsCsv(bomb)).toEqual({ status: 'unreadable' })
  })

  it('refuses bytes that are not a zip archive', async () => {
    expect(declaredZipSize(new TextEncoder().encode('Nom;Prénom'))).toBeNull()
    expect(await readSpreadsheetAsCsv(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toEqual({
      status: 'unreadable',
    })
  })
})
