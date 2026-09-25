import type { FileUIPart, TextUIPart, UIMessage } from 'ai'
import {
  AI_ASSISTANT_DATA_URL_PREFIX,
  AI_ASSISTANT_LIMITS,
  AI_ASSISTANT_MAX_IMAGE_BASE64_LENGTH,
  isAiAssistantImageType,
} from '@/domain/ai-assistant'
import type { ImageSanitizer } from './sanitize-image'
import { PROPOSE_ENROLLMENT_TOOL } from './schemas'

type ChatMessageRefusal =
  | 'invalidRequest'
  | 'tooManyMessages'
  | 'messageTooLong'
  | 'tooManyImages'
  | 'imageTooLarge'
  | 'forbiddenFile'
  | 'unreadableImage'

export type NormalizeChatMessagesResult =
  | { status: 'OK'; messages: UIMessage[] }
  | { status: ChatMessageRefusal }

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const PROPOSAL_PART_TYPE = `tool-${PROPOSE_ENROLLMENT_TOOL}`

/**
 * Rejoue la conversation reçue du navigateur en ne gardant que ce que la route sait
 * défendre.
 *
 * Le client renvoie tout l'historique à chaque tour, y compris les tours de l'assistant
 * qu'il a lui-même reçus. On ne lui fait pas confiance pour autant : une partie
 * inconnue, une image sans préfixe `data:` ou hors budget, un texte démesuré font
 * refuser la requête entière plutôt que d'être passés au fournisseur. Chaque image est
 * réencodée, même celles des tours précédents, puisqu'un client peut les remplacer.
 *
 * Les URL distantes ne sont jamais suivies : seule une `data:` acceptée par le préfixe
 * strict atteint le décodeur, donc aucun téléchargement arbitraire n'est possible.
 */
export async function normalizeChatMessages(
  raw: unknown,
  sanitize: ImageSanitizer
): Promise<NormalizeChatMessagesResult> {
  if (!isRecord(raw) || !Array.isArray(raw.messages)) return { status: 'invalidRequest' }
  if (raw.messages.length === 0) return { status: 'invalidRequest' }
  if (raw.messages.length > AI_ASSISTANT_LIMITS.maxMessages) return { status: 'tooManyMessages' }

  const messages: UIMessage[] = []
  let imagesInRequest = 0

  for (const [index, item] of raw.messages.entries()) {
    if (!isRecord(item) || !Array.isArray(item.parts)) return { status: 'invalidRequest' }
    const role = item.role
    if (role !== 'user' && role !== 'assistant') return { status: 'invalidRequest' }

    const parts: UIMessage['parts'] = []
    let imagesInMessage = 0
    let textChars = 0

    for (const part of item.parts) {
      if (!isRecord(part) || typeof part.type !== 'string') return { status: 'invalidRequest' }

      if (part.type === 'text') {
        if (typeof part.text !== 'string') return { status: 'invalidRequest' }
        textChars += part.text.length
        if (textChars > AI_ASSISTANT_LIMITS.maxTextChars) return { status: 'messageTooLong' }
        parts.push({ type: 'text', text: part.text } satisfies TextUIPart)
        continue
      }

      if (role === 'assistant') {
        if (part.type === 'step-start') {
          parts.push({ type: 'step-start' })
          continue
        }
        if (part.type === PROPOSAL_PART_TYPE && part.state === 'output-available') {
          if (typeof part.toolCallId !== 'string') return { status: 'invalidRequest' }
          if (!isRecord(part.input) || !isRecord(part.output)) return { status: 'invalidRequest' }
          // Une proposition rejouée est du texte pour le fournisseur : elle consomme le
          // même budget, sinon le client contournerait la borne par cette partie.
          textChars += JSON.stringify(part.input).length + JSON.stringify(part.output).length
          if (textChars > AI_ASSISTANT_LIMITS.maxTextChars) return { status: 'messageTooLong' }
          parts.push({
            type: PROPOSAL_PART_TYPE,
            toolCallId: part.toolCallId,
            state: 'output-available',
            input: part.input,
            output: part.output,
          } as UIMessage['parts'][number])
          continue
        }
        // Les appels d'outil incomplets ou en erreur ne se rejouent pas : le fournisseur
        // les verrait comme une conversation cassée. Ils sont ignorés, pas refusés.
        continue
      }

      if (part.type !== 'file') return { status: 'forbiddenFile' }
      if (typeof part.mediaType !== 'string' || !isAiAssistantImageType(part.mediaType)) {
        return { status: 'forbiddenFile' }
      }
      if (typeof part.url !== 'string') return { status: 'forbiddenFile' }

      imagesInMessage += 1
      imagesInRequest += 1
      if (
        imagesInMessage > AI_ASSISTANT_LIMITS.maxImagesPerMessage ||
        imagesInRequest > AI_ASSISTANT_LIMITS.maxImagesPerRequest
      ) {
        return { status: 'tooManyImages' }
      }

      const match = AI_ASSISTANT_DATA_URL_PREFIX.exec(part.url)
      if (!match) return { status: 'forbiddenFile' }
      const base64 = part.url.slice(match[0].length)
      if (base64.length > AI_ASSISTANT_MAX_IMAGE_BASE64_LENGTH) return { status: 'imageTooLarge' }

      const bytes = new Uint8Array(Buffer.from(base64, 'base64'))
      if (bytes.byteLength === 0 || bytes.byteLength > AI_ASSISTANT_LIMITS.maxImageBytes) {
        return { status: bytes.byteLength === 0 ? 'unreadableImage' : 'imageTooLarge' }
      }

      const sanitized = await sanitize(bytes)
      if (sanitized.status !== 'OK') return { status: sanitized.status }

      parts.push({
        type: 'file',
        mediaType: 'image/webp',
        filename: typeof part.filename === 'string' ? part.filename.slice(0, 120) : undefined,
        url: sanitized.dataUrl,
      } satisfies FileUIPart)
    }

    if (parts.length === 0) return { status: 'invalidRequest' }
    messages.push({ id: `m${index}`, role, parts })
  }

  if (messages[messages.length - 1]?.role !== 'user') return { status: 'invalidRequest' }

  return { status: 'OK', messages }
}
