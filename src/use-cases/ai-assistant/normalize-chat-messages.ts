import type { FileUIPart, TextUIPart, UIMessage } from 'ai'
import {
  AI_ASSISTANT_DATA_URL_PREFIX,
  AI_ASSISTANT_LIMITS,
  AI_ASSISTANT_MAX_IMAGE_BASE64_LENGTH,
  AI_ASSISTANT_PDF_TYPE,
  isAiAssistantAttachmentType,
} from '@/domain/ai-assistant'
import type { ImageSanitizer } from './sanitize-image'

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]

const isPdf = (bytes: Uint8Array) => PDF_SIGNATURE.every((byte, index) => bytes[index] === byte)

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

type ToolPart = Extract<UIMessage['parts'][number], { toolCallId: string }>

type NormalizeOptions = {
  /** Outils de l'assistant dont les appels terminés se rejouent. Absent, aucun ne l'est. */
  toolNames?: ReadonlySet<string>
}

/**
 * Approbation rejouée telle que le SDK l'a émise : la signature HMAC qu'elle porte est
 * revérifiée côté serveur, un client ne peut donc pas en fabriquer une valide.
 */
function readApproval(raw: unknown, approved?: boolean) {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.approved !== 'boolean') {
    return null
  }
  if (approved !== undefined && raw.approved !== approved) return null
  return {
    id: raw.id,
    approved: raw.approved,
    ...(typeof raw.reason === 'string' ? { reason: raw.reason.slice(0, 500) } : {}),
    ...(typeof raw.signature === 'string' ? { signature: raw.signature } : {}),
    ...(typeof raw.isAutomatic === 'boolean' ? { isAutomatic: raw.isAutomatic } : {}),
    ...('inputSchemaInput' in raw ? { inputSchemaInput: raw.inputSchemaInput } : {}),
  }
}

/**
 * Un appel d'outil terminé, refusé ou en attente de réponse humaine se rejoue ; un appel
 * en cours de flux est ignoré (`null`). Une forme incohérente fait refuser la requête.
 */
function replayToolPart(part: UnknownRecord): ToolPart | null | 'invalid' {
  if (typeof part.toolCallId !== 'string') return 'invalid'
  const base = { type: part.type, toolCallId: part.toolCallId }

  switch (part.state) {
    case 'output-available': {
      if (!isRecord(part.input) || part.output === undefined) return 'invalid'
      const approval = part.approval === undefined ? undefined : readApproval(part.approval, true)
      if (approval === null) return 'invalid'
      return {
        ...base,
        state: 'output-available',
        input: part.input,
        output: part.output,
        ...(approval ? { approval } : {}),
      } as ToolPart
    }
    case 'output-error': {
      if (typeof part.errorText !== 'string') return 'invalid'
      const approval = part.approval === undefined ? undefined : readApproval(part.approval, true)
      if (approval === null) return 'invalid'
      return {
        ...base,
        state: 'output-error',
        input: isRecord(part.input) ? part.input : undefined,
        errorText: part.errorText.slice(0, 500),
        ...(approval ? { approval } : {}),
      } as ToolPart
    }
    case 'output-denied':
    case 'approval-responded': {
      if (!isRecord(part.input)) return 'invalid'
      const approval = readApproval(
        part.approval,
        part.state === 'output-denied' ? false : undefined
      )
      if (!approval) return 'invalid'
      return { ...base, state: part.state, input: part.input, approval } as ToolPart
    }
    default:
      return null
  }
}

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
const MESSAGE_ID_PATTERN = /^[\w-]{1,64}$/

export async function normalizeChatMessages(
  raw: unknown,
  sanitize: ImageSanitizer,
  { toolNames = new Set() }: NormalizeOptions = {}
): Promise<NormalizeChatMessagesResult> {
  if (!isRecord(raw) || !Array.isArray(raw.messages)) return { status: 'invalidRequest' }
  if (raw.messages.length === 0) return { status: 'invalidRequest' }
  if (raw.messages.length > AI_ASSISTANT_LIMITS.maxMessages) return { status: 'tooManyMessages' }

  const messages: UIMessage[] = []
  let imagesInRequest = 0
  let toolChars = 0
  let pendingApproval = false

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
        const toolName = part.type.startsWith('tool-') ? part.type.slice('tool-'.length) : null
        if (toolName !== null && toolNames.has(toolName)) {
          const replayed = replayToolPart(part)
          if (replayed === 'invalid') return { status: 'invalidRequest' }
          if (replayed === null) continue
          // Les résultats d'outils rejoués coûtent des jetons à chaque tour : leur budget est
          // celui de la requête entière, plus large que celui d'un message saisi.
          toolChars += JSON.stringify(replayed).length
          if (toolChars > AI_ASSISTANT_LIMITS.maxToolReplayChars) {
            return { status: 'messageTooLong' }
          }
          if (index === raw.messages.length - 1 && replayed.state === 'approval-responded') {
            pendingApproval = true
          }
          parts.push(replayed)
          continue
        }
        // Les appels d'outil incomplets ou en erreur ne se rejouent pas : le fournisseur
        // les verrait comme une conversation cassée. Ils sont ignorés, pas refusés.
        continue
      }

      if (part.type !== 'file') return { status: 'forbiddenFile' }
      if (typeof part.mediaType !== 'string' || !isAiAssistantAttachmentType(part.mediaType)) {
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

      const filename = typeof part.filename === 'string' ? part.filename.slice(0, 120) : undefined

      if (part.mediaType === AI_ASSISTANT_PDF_TYPE || match[1] === AI_ASSISTANT_PDF_TYPE) {
        if (part.mediaType !== match[1]) return { status: 'forbiddenFile' }
        if (!isPdf(bytes)) return { status: 'unreadableImage' }
        parts.push({
          type: 'file',
          mediaType: AI_ASSISTANT_PDF_TYPE,
          filename,
          url: part.url,
        } satisfies FileUIPart)
        continue
      }

      const sanitized = await sanitize(bytes)
      if (sanitized.status !== 'OK') return { status: sanitized.status }

      parts.push({
        type: 'file',
        mediaType: 'image/webp',
        filename,
        url: sanitized.dataUrl,
      } satisfies FileUIPart)
    }

    if (parts.length === 0) return { status: 'invalidRequest' }
    // L'identifiant du client est gardé quand il est sain : la conversation enregistrée et
    // le tour qui reprend un message après une validation doivent désigner le même.
    const id =
      typeof item.id === 'string' && MESSAGE_ID_PATTERN.test(item.id) ? item.id : `m${index}`
    messages.push({ id, role, parts })
  }

  // Une réponse d'approbation se renvoie dans le dernier message de l'assistant, sans tour
  // utilisateur : c'est la seule exception à la règle.
  if (messages[messages.length - 1]?.role !== 'user' && !pendingApproval) {
    return { status: 'invalidRequest' }
  }

  return { status: 'OK', messages }
}
