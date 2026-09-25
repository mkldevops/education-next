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
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-sonnet-4.5',
  'openai/gpt-4.1-mini',
  'openai/gpt-4o-mini',
] as const

export type AiAssistantModel = (typeof AI_ASSISTANT_MODELS)[number]

export const DEFAULT_AI_ASSISTANT_MODEL: AiAssistantModel = 'google/gemini-2.5-flash'

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
 * Bornes d'une requête de chat. Elles s'appliquent à la conversation entière, puisque le
 * client la renvoie à chaque tour : une photo acceptée hier compte encore aujourd'hui.
 */
export const AI_ASSISTANT_LIMITS = {
  /** Photos jointes à un seul message. */
  maxImagesPerMessage: 4,
  /** Photos sur toute la conversation renvoyée. */
  maxImagesPerRequest: 8,
  /** Poids d'une photo telle que reçue, avant réencodage. */
  maxImageBytes: 6 * 1024 * 1024,
  /** Surface décodée : 6000 × 6000, au-delà sharp refuse avant d'allouer. */
  maxImagePixels: 6000 * 6000,
  /** Plus grand côté conservé après réencodage. */
  maxImageDimension: 2000,
  maxMessages: 40,
  maxTextChars: 8000,
  maxOutputTokens: 4000,
  maxSteps: 3,
  timeoutMs: 60 * 1000,
  requestsPerMinute: 20,
} as const

export const AI_ASSISTANT_DATA_URL_PREFIX = /^data:(image\/(?:png|jpeg|webp));base64,/

/** Longueur base64 maximale déduite du poids brut : 4 caractères pour 3 octets. */
export const AI_ASSISTANT_MAX_IMAGE_BASE64_LENGTH = Math.ceil(
  (AI_ASSISTANT_LIMITS.maxImageBytes / 3) * 4
)
