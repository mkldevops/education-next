import type { UIMessage } from 'ai'
import { AI_ASSISTANT_LIMITS, assistantContextLoad } from '@/domain/ai-assistant'

const BLOCKING_ERRORS = new Set(['tooManyMessages', 'tooManyImages'])

/**
 * Quand proposer de poursuivre dans une conversation résumée : près d'une borne, ou refusée
 * par l'une d'elles. Un texte trop long n'y est pour rien, sauf si les résultats d'outils
 * rejoués sont la cause.
 */
export function compactOffer(messages: UIMessage[], errorCode: string | null) {
  if (messages.length === 0) return null
  const load = assistantContextLoad(messages)
  if (
    errorCode &&
    (BLOCKING_ERRORS.has(errorCode) || (errorCode === 'messageTooLong' && load.toolBudget))
  ) {
    return 'blocked' as const
  }
  return load.heavy ? ('heavy' as const) : null
}

const textOf = (message: UIMessage) =>
  message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n')
    .trim()

/**
 * Ce que le résumé reçoit : aucune pièce jointe (seul son nom reste) ; la dernière question
 * restée sans réponse n'est pas résumée mais reprise telle quelle dans le champ.
 */
export function compactRequest(messages: UIMessage[]) {
  const last = messages.at(-1)
  const pending = last?.role === 'user' ? last : null
  const history = pending ? messages.slice(0, -1) : messages
  return {
    draft: pending ? textOf(pending) : '',
    messages: history
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role,
        parts: message.parts.map((part) =>
          part.type === 'file' ? { type: 'file', filename: part.filename } : part
        ),
      })),
  }
}

/** Titre repris de la première question, borné comme celui d'une conversation enregistrée. */
export function compactTitle(messages: UIMessage[]) {
  const first = messages.find((message) => message.role === 'user')
  const text = first ? textOf(first).replace(/\s+/g, ' ') : ''
  return text.length > 60 ? `${text.slice(0, 59)}…` : text
}

/**
 * Amorce de la nouvelle conversation : une question puis le résumé en réponse, car un
 * historique qui commence par l'assistant est refusé par certains fournisseurs. Le tout
 * reste sous `maxTextChars`, la borne de chaque message rejoué.
 */
export function compactSeed(question: string, heading: string, summary: string): UIMessage[] {
  const answer = `${heading}\n\n${summary}`.slice(0, AI_ASSISTANT_LIMITS.maxTextChars)
  return [
    { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: question }] },
    { id: crypto.randomUUID(), role: 'assistant', parts: [{ type: 'text', text: answer }] },
  ]
}
