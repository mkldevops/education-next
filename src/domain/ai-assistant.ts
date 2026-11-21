/**
 * Modèles OpenRouter admis pour l'assistant d'inscription.
 *
 * Liste fermée : l'assistant envoie des photos et attend un appel d'outil, donc seul un
 * modèle qui lit une image **et** appelle un outil convient. Un identifiant libre en
 * variable d'environnement laisserait un opérateur pointer un modèle texte seul, et
 * l'échec n'apparaîtrait qu'au premier envoi de photo. Le défaut est le moins cher de
 * la liste ; le choix définitif se valide sur de vraies fiches, pas ici.
 */
export const AI_ASSISTANT_MODELS = [
  'deepseek/deepseek-v4.1-flash',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-sonnet-4.5',
  'openai/gpt-4.1-mini',
  'openai/gpt-4o-mini',
] as const

export type AiAssistantModel = (typeof AI_ASSISTANT_MODELS)[number]

export const DEFAULT_AI_ASSISTANT_MODEL: AiAssistantModel = 'deepseek/deepseek-v4.1-flash'

export function resolveAiAssistantModel(raw: string | undefined): AiAssistantModel {
  const candidate = raw?.trim()
  const known = AI_ASSISTANT_MODELS.find((model) => model === candidate)
  return known ?? DEFAULT_AI_ASSISTANT_MODEL
}

const AI_ASSISTANT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export type AiAssistantImageType = (typeof AI_ASSISTANT_IMAGE_TYPES)[number]

export function isAiAssistantImageType(value: string): value is AiAssistantImageType {
  return (AI_ASSISTANT_IMAGE_TYPES as readonly string[]).includes(value)
}

/**
 * Un PDF n'est pas réencodé : OpenRouter l'analyse lui-même, quel que soit le modèle. Seule
 * la signature `%PDF-` est vérifiée, pour qu'un autre format ne passe pas sous ce type.
 */
export const AI_ASSISTANT_PDF_TYPE = 'application/pdf'

export function isAiAssistantAttachmentType(value: string) {
  return isAiAssistantImageType(value) || value === AI_ASSISTANT_PDF_TYPE
}

/**
 * Bornes d'une requête de chat. Elles s'appliquent à la conversation entière, puisque le
 * client la renvoie à chaque tour : une photo acceptée hier compte encore aujourd'hui.
 */
export const AI_ASSISTANT_LIMITS = {
  /** Pièces jointes (photos et PDF) à un seul message. */
  maxImagesPerMessage: 4,
  /** Pièces jointes sur toute la conversation renvoyée. */
  maxImagesPerRequest: 8,
  /** Poids d'une pièce jointe telle que reçue, avant réencodage. */
  maxImageBytes: 6 * 1024 * 1024,
  /** Surface décodée : 6000 × 6000, au-delà sharp refuse avant d'allouer. */
  maxImagePixels: 6000 * 6000,
  /** Plus grand côté conservé après réencodage. */
  maxImageDimension: 2000,
  maxMessages: 40,
  maxTextChars: 8000,
  /**
   * Budget d'une étape, raisonnement compris : un modèle qui raisonne le consommait en entier
   * et la réponse s'arrêtait au milieu d'une phrase (`finishReason: length`).
   */
  maxOutputTokens: 12_000,
  /** Plafond du raisonnement par étape, pour laisser au texte au moins 8 000 jetons. */
  maxReasoningTokens: 4_000,
  /** Relances d'une réponse coupée par la limite de jetons avant de prévenir l'administrateur. */
  maxContinuations: 2,
  maxSteps: 3,
  /** Enchaînement lecture → aperçu → écriture de l'assistant général. */
  maxAgentSteps: 8,
  /** Résultats d'outils rejoués sur toute la conversation de l'assistant général. */
  maxToolReplayChars: 60_000,
  timeoutMs: 60 * 1000,
  /** Plusieurs appels au fournisseur par tour : budget plus large que l'inscription. */
  agentTimeoutMs: 110 * 1000,
  requestsPerMinute: 20,
} as const

export const AI_ASSISTANT_DATA_URL_PREFIX =
  /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,/

/** Longueur base64 maximale déduite du poids brut : 4 caractères pour 3 octets. */
export const AI_ASSISTANT_MAX_IMAGE_BASE64_LENGTH = Math.ceil(
  (AI_ASSISTANT_LIMITS.maxImageBytes / 3) * 4
)

/** Part de chaque borne de conversation au-delà de laquelle le résumé est proposé. */
const HEAVY_SHARE = 0.75

type LoadMessage = { role: string; parts: ReadonlyArray<{ type: string }> }

export type AssistantContextLoad = {
  heavy: boolean
  /** Résultats d'outils rejoués proches de leur budget : seule cause de `messageTooLong` qui tient à l'historique. */
  toolBudget: boolean
}

/**
 * Charge d'une conversation au regard des bornes de `normalizeChatMessages`. Chaque tour
 * renvoie tout l'historique : près d'une borne, la conversation sera bientôt refusée et
 * l'assistant propose de la poursuivre dans une nouvelle, résumée.
 */
export function assistantContextLoad(messages: readonly LoadMessage[]): AssistantContextLoad {
  let attachments = 0
  let toolChars = 0
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === 'file') attachments += 1
      else if (message.role === 'assistant' && part.type.startsWith('tool-')) {
        toolChars += JSON.stringify(part).length
      }
    }
  }
  const toolBudget = toolChars >= AI_ASSISTANT_LIMITS.maxToolReplayChars * HEAVY_SHARE
  const heavy =
    toolBudget ||
    messages.length >= AI_ASSISTANT_LIMITS.maxMessages * HEAVY_SHARE ||
    attachments >= AI_ASSISTANT_LIMITS.maxImagesPerRequest * HEAVY_SHARE
  return { heavy, toolBudget }
}

export const AI_ASSISTANT_SUMMARY_LIMITS = {
  /** Messages lus pour le résumé : les plus récents, la borne d'une requête de chat n'y joue pas. */
  maxMessages: 200,
  /** Transcription envoyée au modèle ; au-delà, les messages les plus anciens tombent. */
  maxTranscriptChars: 80_000,
  /** Extrait d'entrée ou de résultat d'outil gardé par appel. */
  maxToolExcerptChars: 600,
  /** Le résumé amorce un message d'assistant, borné comme tout texte par `maxTextChars`. */
  maxSummaryChars: 6_000,
  maxOutputTokens: 6_000,
  maxReasoningTokens: 1_500,
  timeoutMs: 60 * 1000,
} as const

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const excerpt = (value: unknown) => {
  if (value === undefined) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const max = AI_ASSISTANT_SUMMARY_LIMITS.maxToolExcerptChars
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * Ce qu'est devenu un appel d'outil. Le résumé ne doit jamais présenter une proposition
 * comme faite : seul un résultat obtenu sans refus est `executed`.
 */
function toolOutcome(part: UnknownRecord) {
  const approval = isRecord(part.approval) ? part.approval.approved : undefined
  switch (part.state) {
    case 'output-available':
      return approval === false ? 'refused' : 'executed'
    case 'output-error':
      return 'failed'
    case 'output-denied':
      return 'refused'
    case 'approval-requested':
    case 'approval-responded':
      return 'awaiting-validation-not-done'
    default:
      return 'not-done'
  }
}

function transcriptLine(role: 'user' | 'assistant', part: unknown) {
  if (!isRecord(part) || typeof part.type !== 'string') return null
  const who = role === 'user' ? 'ADMIN' : 'ASSISTANT'
  if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
    return `${who}: ${part.text.trim()}`
  }
  if (part.type === 'file') {
    const name = typeof part.filename === 'string' ? part.filename.slice(0, 120) : 'file'
    return `${who}: [attachment ${name}, not available anymore]`
  }
  if (role === 'assistant' && part.type.startsWith('tool-')) {
    const name = part.type.slice('tool-'.length).slice(0, 80)
    const output = part.state === 'output-error' ? part.errorText : part.output
    return `TOOL ${name} [${toolOutcome(part)}] input=${excerpt(part.input)} result=${excerpt(output)}`
  }
  return null
}

/**
 * Transcription texte d'une conversation pour son résumé : texte, pièces jointes nommées,
 * chaque appel d'outil avec son issue. Les plus anciens messages tombent d'abord.
 */
export function assistantSummaryTranscript(
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; parts: readonly unknown[] }>
) {
  const blocks = messages
    .map((message) =>
      message.parts
        .map((part) => transcriptLine(message.role, part))
        .filter((line): line is string => line !== null)
        .join('\n')
    )
    .filter(Boolean)
  const kept: string[] = []
  let size = 0
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index]
    if (size + block.length > AI_ASSISTANT_SUMMARY_LIMITS.maxTranscriptChars) break
    kept.unshift(block)
    size += block.length + 2
  }
  return kept.join('\n\n')
}
