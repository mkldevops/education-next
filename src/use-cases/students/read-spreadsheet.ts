import readXlsxFile from 'read-excel-file/node'

/** Signature locale d'une archive ZIP, dont un `.xlsx` est une instance. */
export const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const

const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50
const MAX_COMMENT_LENGTH = 0xffff
/** Un classeur de quelques centaines d'élèves pèse bien moins une fois décompressé. */
const MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024
const MAX_ENTRIES = 200

type SpreadsheetResult = { status: 'OK'; text: string } | { status: 'unreadable' }

export type SpreadsheetReader = (bytes: Uint8Array) => Promise<SpreadsheetResult>

/**
 * Taille décompressée annoncée par le répertoire central, sans rien décompresser. Une archive
 * qui annonce trop (bombe de décompression), qui ne se décrit pas ou en ZIP64 est refusée avant
 * d'atteindre l'analyseur. Le risque résiduel est une archive qui ment sur ses tailles :
 * l'analyseur reste alors borné par la taille du fichier reçu (6 Mo) et le délai de l'action.
 */
export function declaredZipSize(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const lowest = Math.max(0, bytes.length - 22 - MAX_COMMENT_LENGTH)
  let end = -1
  for (let offset = bytes.length - 22; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) {
      end = offset
      break
    }
  }
  if (end < 0) return null

  const entries = view.getUint16(end + 10, true)
  const directoryOffset = view.getUint32(end + 16, true)
  if (entries === 0 || entries > MAX_ENTRIES || directoryOffset >= end) return null

  let total = 0
  let offset = directoryOffset
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY) return null
    const size = view.getUint32(offset + 24, true)
    if (size === 0xffffffff) return null
    total += size
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true)
  }
  return total
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Convertit chaque feuille du classeur en texte `;`-séparé, précédé de son nom, pour le modèle.
 * Les dates Excel arrivent en `YYYY-MM-DD`. Les lignes vides sont omises.
 */
export const readSpreadsheetAsCsv: SpreadsheetReader = async (bytes) => {
  const size = declaredZipSize(bytes)
  if (size === null || size > MAX_UNCOMPRESSED_BYTES) return { status: 'unreadable' }
  try {
    // Un Buffer, jamais une chaîne : la bibliothèque lirait une chaîne comme un chemin.
    const sheets = await readXlsxFile(Buffer.from(bytes))
    const text = sheets
      .map(({ sheet, data }) => {
        const lines = data
          .map((row) => row.map(csvCell).join(';'))
          .filter((line) => line.replace(/;/g, '').trim() !== '')
        return lines.length > 0 ? `# ${sheet}\n${lines.join('\n')}` : ''
      })
      .filter(Boolean)
      .join('\n\n')
    return text ? { status: 'OK', text } : { status: 'unreadable' }
  } catch {
    return { status: 'unreadable' }
  }
}
