import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  capFormerStudentRows,
  FORMER_STUDENT_FIELDS,
  FORMER_STUDENT_IMPORT_LIMITS,
  type FormerStudentDraft,
  type FormerStudentField,
} from '@/domain/former-student-import'
import { createRateLimiter } from '@/lib/rate-limit'
import { type ImageSanitizer, sanitizeImage } from '@/use-cases/ai-assistant/sanitize-image'
import { isAiAssistantEnabled } from '@/use-cases/platform-settings/is-ai-assistant-enabled'
import { readOpenRouterApiKey } from '@/use-cases/platform-settings/openrouter-api-key'
import { readSpreadsheetAsCsv, type SpreadsheetReader, ZIP_SIGNATURE } from './read-spreadsheet'

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const TEXT_TYPES = new Set(['text/csv', 'text/plain', 'application/csv', 'text/x-csv'])
/** Une lecture coûte : quelques essais par minute suffisent à corriger un mauvais cadrage. */
const EXTRACTIONS_PER_MINUTE = 6

/** Ce que le modèle reçoit, un document par fichier. */
export type FormerStudentSource =
  | { kind: 'text'; name: string; text: string }
  | { kind: 'image'; name: string; dataUrl: string }
  | { kind: 'pdf'; name: string; base64: string }

/**
 * Port vers le modèle. Sa sortie est relue ici avec Zod : un adaptateur ne peut faire entrer
 * qu'une liste de champs texte, jamais un identifiant ou une école.
 */
export type FormerStudentExtractor = (input: {
  apiKey: string
  sources: FormerStudentSource[]
}) => Promise<{ status: 'OK'; output: unknown } | { status: 'providerError' | 'unreadable' }>

export type UploadedFile = { name: string; type: string; bytes: Uint8Array }

type ExtractFormerStudentsError =
  | 'aiDisabled'
  | 'aiNotConfigured'
  | 'tooManyRequests'
  | 'tooManyFiles'
  | 'forbiddenFile'
  | 'fileTooLarge'
  | 'unreadable'
  | 'nothingFound'
  | 'providerError'

export type ExtractFormerStudentsResult =
  | { status: 'OK'; rows: FormerStudentDraft[]; truncated: boolean }
  | { status: ExtractFormerStudentsError }

const isRateLimited = createRateLimiter({ limit: EXTRACTIONS_PER_MINUTE, windowMs: 60 * 1000 })

type Deps = {
  extract: FormerStudentExtractor
  isEnabled: () => Promise<boolean>
  readApiKey: () => Promise<string | null>
  isRateLimited: (key: string) => boolean
  sanitizeImage: ImageSanitizer
  readSpreadsheet: SpreadsheetReader
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)

const extensionOf = (name: string) => name.toLowerCase().split('.').pop() ?? ''

/** CSV exporté par un tableur français : UTF-8, sinon Windows-1252. Un octet nul n'est pas du texte. */
function decodeText(bytes: Uint8Array) {
  if (bytes.includes(0)) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

type SourceResult =
  | { status: 'OK'; source: FormerStudentSource }
  | { status: ExtractFormerStudentsError }

/**
 * Le contenu décide du traitement, pas le type annoncé par le navigateur : un PDF ou un classeur
 * se reconnaît à sa signature, une image passe par `sharp` qui refuse tout autre format, et
 * seul un fichier déclaré CSV/TXT est lu comme du texte.
 */
async function toSource(file: UploadedFile, deps: Deps): Promise<SourceResult> {
  const { bytes, name } = file
  const extension = extensionOf(name)
  if (startsWith(bytes, PDF_SIGNATURE)) {
    return {
      status: 'OK',
      source: { kind: 'pdf', name, base64: Buffer.from(bytes).toString('base64') },
    }
  }
  if (startsWith(bytes, ZIP_SIGNATURE)) {
    if (extension !== 'xlsx' && file.type !== XLSX_TYPE) return { status: 'forbiddenFile' }
    const sheet = await deps.readSpreadsheet(bytes)
    if (sheet.status !== 'OK') return { status: 'unreadable' }
    return { status: 'OK', source: { kind: 'text', name, text: sheet.text } }
  }
  if (TEXT_TYPES.has(file.type) || extension === 'csv' || extension === 'txt') {
    const text = decodeText(bytes)
    if (text === null) return { status: 'forbiddenFile' }
    if (text.trim() === '') return { status: 'nothingFound' }
    return { status: 'OK', source: { kind: 'text', name, text } }
  }
  const image = await deps.sanitizeImage(bytes)
  if (image.status === 'OK') {
    return { status: 'OK', source: { kind: 'image', name, dataUrl: image.dataUrl } }
  }
  if (image.status === 'imageTooLarge') return { status: 'fileTooLarge' }
  return { status: image.status === 'forbiddenFile' ? 'forbiddenFile' : 'unreadable' }
}

const fieldValue = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => (value === null || value === undefined ? '' : String(value).trim()))

const extractedField = z
  .object({ value: fieldValue, uncertain: z.boolean().optional().default(false) })
  .nullish()
  .transform((field) => field ?? { value: '', uncertain: false })

const extractedStudentSchema = z.object({
  lastname: extractedField,
  firstname: extractedField,
  birthday: extractedField,
  className: extractedField,
  departureYear: extractedField,
})

const extractionOutputSchema = z.object({ students: z.array(z.unknown()) })

/** Les lignes illisibles sont écartées une à une ; une ligne entièrement vide aussi. */
function toDrafts(output: unknown): FormerStudentDraft[] | null {
  const parsed = extractionOutputSchema.safeParse(output)
  if (!parsed.success) return null
  const drafts: FormerStudentDraft[] = []
  for (const raw of parsed.data.students) {
    const student = extractedStudentSchema.safeParse(raw)
    if (!student.success) continue
    const values = Object.fromEntries(
      FORMER_STUDENT_FIELDS.map((field) => [field, student.data[field].value])
    ) as Record<FormerStudentField, string>
    if (Object.values(values).every((value) => value === '')) continue
    drafts.push({
      id: randomUUID(),
      ...values,
      included: true,
      uncertain: FORMER_STUDENT_FIELDS.filter((field) => student.data[field].uncertain),
    })
  }
  return drafts
}

/**
 * Lit les fichiers déposés et renvoie les lignes à relire. Rien n'est écrit : l'école corrige
 * puis confirme. Les gardes suivent l'assistant IA (drapeau, clé, quota par admin et école).
 */
export async function extractFormerStudents(
  input: { schoolId: string; userId: string; files: UploadedFile[] },
  deps: Partial<Deps> & Pick<Deps, 'extract'>
): Promise<ExtractFormerStudentsResult> {
  const resolved: Deps = {
    isEnabled: () => isAiAssistantEnabled(),
    readApiKey: () => readOpenRouterApiKey(),
    isRateLimited,
    sanitizeImage,
    readSpreadsheet: readSpreadsheetAsCsv,
    ...deps,
  }
  const { maxFiles, maxFileBytes, maxTotalBytes, maxTextChars } = FORMER_STUDENT_IMPORT_LIMITS

  if (!(await resolved.isEnabled())) return { status: 'aiDisabled' }
  const apiKey = await resolved.readApiKey()
  if (!apiKey) return { status: 'aiNotConfigured' }

  const { files } = input
  if (files.length === 0) return { status: 'nothingFound' }
  if (files.length > maxFiles) return { status: 'tooManyFiles' }
  const total = files.reduce((sum, file) => sum + file.bytes.length, 0)
  if (files.some((file) => file.bytes.length > maxFileBytes) || total > maxTotalBytes) {
    return { status: 'fileTooLarge' }
  }
  if (resolved.isRateLimited(`${input.userId}:${input.schoolId}`)) {
    return { status: 'tooManyRequests' }
  }

  const sources: FormerStudentSource[] = []
  for (const file of files) {
    const result = await toSource(file, resolved)
    if (result.status !== 'OK') return { status: result.status }
    sources.push(result.source)
  }
  const textLength = sources.reduce(
    (sum, source) => sum + (source.kind === 'text' ? source.text.length : 0),
    0
  )
  if (textLength > maxTextChars) return { status: 'fileTooLarge' }

  const extracted = await resolved.extract({ apiKey, sources })
  if (extracted.status !== 'OK') return { status: extracted.status }

  const drafts = toDrafts(extracted.output)
  if (drafts === null) return { status: 'unreadable' }
  if (drafts.length === 0) return { status: 'nothingFound' }
  const { rows, truncated } = capFormerStudentRows(drafts)
  return { status: 'OK', rows, truncated }
}
