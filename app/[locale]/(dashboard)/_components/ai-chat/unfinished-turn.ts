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

/**
 * Le serveur relance une réponse coupée par la limite de jetons ; quand les relances ne
 * suffisent pas, il marque le message `truncated` pour que l'administrateur demande la suite.
 */
export function endedTruncated(messages: ReadonlyArray<UIMessage>): boolean {
  const last = messages.at(-1)
  if (last?.role !== 'assistant') return false
  const metadata = last.metadata
  return typeof metadata === 'object' && metadata !== null && 'truncated' in metadata
    ? metadata.truncated === true
    : false
}

/**
 * Une relance ajoute son texte dans une nouvelle partie du même message : les parties de texte
 * consécutives se recollent pour se lire comme une seule phrase.
 */
export function joinAdjacentText(parts: UIMessage['parts']): UIMessage['parts'] {
  const joined: UIMessage['parts'] = []
  for (const part of parts) {
    const previous = joined.at(-1)
    if (part.type === 'text' && previous?.type === 'text') {
      joined[joined.length - 1] = { ...previous, text: previous.text + part.text }
    } else {
      joined.push(part)
    }
  }
  return joined
}
