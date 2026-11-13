import { isToolUIPart, type UIMessage } from 'ai'

/**
 * Un tour de l'assistant coupé en route (délai, limite de jetons) finit sur un outil ou un
 * raisonnement sans aucun texte après : l'administrateur croirait la demande traitée. Une
 * carte d'approbation en attente n'est pas une coupure, c'est la question posée.
 */
export function endedWithoutAnswer(messages: ReadonlyArray<UIMessage>): boolean {
  const last = messages.at(-1)
  if (last?.role !== 'assistant') return false
  if (last.parts.some((part) => isToolUIPart(part) && part.state === 'approval-requested')) {
    return false
  }
  const final = last.parts.filter((part) => part.type !== 'step-start').at(-1)
  return final !== undefined && final.type !== 'text'
}
