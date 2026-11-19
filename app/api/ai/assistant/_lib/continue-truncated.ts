import type { ModelMessage, UIMessageChunk } from 'ai'

type FinishedStep = { finishReason: string; toolCalls: ReadonlyArray<unknown> }

/**
 * Un tour coupé par la limite de jetons au milieu de son texte se relance ; un tour coupé au
 * milieu d'un appel d'outil ne se relance pas : l'appel tronqué n'a rien produit à poursuivre.
 */
export function endedMidText(steps: ReadonlyArray<FinishedStep>): boolean {
  const last = steps.at(-1)
  return last?.finishReason === 'length' && last.toolCalls.length === 0
}

export const CONTINUE_MESSAGE: ModelMessage = {
  role: 'user',
  content:
    'Your previous reply was cut off by the length limit after its last complete sentence. ' +
    'Continue it from there with the next sentence, without repeating or announcing anything.',
}

/**
 * Fin de phrase, de ligne ou d'introduction de liste, guillemets (espace française comprise)
 * et emphase fermants compris.
 */
const SENTENCE_END = /[.!?…:](?:[ \u00a0\u202f]?["'»”)\]*_])*\s+|\n+/g

/** Longueur de texte jusqu'à la dernière fin de phrase, espaces qui la suivent compris. */
export function completeSentencesLength(text: string) {
  let end = 0
  for (const match of text.matchAll(SENTENCE_END)) end = match.index + match[0].length
  return end
}

/** Début de relance retenu avant raccord : assez pour contenir une phrase répétée. */
export const STITCH_WINDOW = 400

/** Une répétition plus courte se confond avec une tournure reprise par hasard. */
const MIN_OVERLAP = 20

/**
 * Raccorde le début d'une relance au texte affiché, qui s'arrête sur une phrase complète. Une
 * relance qui répète la fin de ce texte en est débarrassée, et l'espace entre les deux phrases
 * est rétabli : un modèle ne l'écrit pas de lui-même.
 */
export function stitchContinuation(previous: string, opening: string) {
  if (!previous.trim()) return opening
  const lead = opening.trimStart()
  const window = previous.slice(-STITCH_WINDOW).trimEnd()
  let rest = opening
  for (const match of window.matchAll(/(?:^|\s)(?=\S)/g)) {
    const suffix = window.slice(match.index + match[0].length)
    if (suffix.length < MIN_OVERLAP) break
    const at = lead.indexOf(suffix)
    if (at !== -1 && at <= STITCH_WINDOW / 2) {
      rest = lead.slice(at + suffix.length)
      break
    }
  }
  if (/\s$/.test(previous)) return rest.trimStart()
  return /^\S/.test(rest) ? ` ${rest}` : rest
}

/** Retire de la réponse coupée la phrase inachevée que l'administrateur n'a pas vue. */
export function withoutUnfinishedSentence(
  response: ReadonlyArray<ModelMessage>,
  unfinished: string
): ModelMessage[] {
  const last = response.at(-1)
  if (!unfinished || last?.role !== 'assistant') return [...response]
  const trim = (text: string) =>
    text.endsWith(unfinished) ? text.slice(0, -unfinished.length).trimEnd() : text
  const content =
    typeof last.content === 'string'
      ? trim(last.content)
      : last.content.map((part, index) =>
          part.type === 'text' && index === last.content.length - 1
            ? { ...part, text: trim(part.text) }
            : part
        )
  return [...response.slice(0, -1), { ...last, content } as ModelMessage]
}

/** Messages de la relance : la conversation, la réponse coupée, puis la consigne de reprise. */
export function continuationMessages(
  history: ReadonlyArray<ModelMessage>,
  response: ReadonlyArray<ModelMessage>
): ModelMessage[] {
  return [...history, ...response, CONTINUE_MESSAGE]
}

type TurnResult = {
  toUIMessageStream: (options: {
    sendStart: boolean
    sendFinish: boolean
    onError: (error: unknown) => string
  }) => AsyncIterable<UIMessageChunk>
  steps: PromiseLike<ReadonlyArray<FinishedStep>>
  response: PromiseLike<{ messages: ModelMessage[] }>
}

/**
 * Écrit un tour dans le flux du message, relancé tant que le texte est coupé par la limite de
 * jetons. Le texte ne part qu'à la fin de chaque phrase : une coupure retire la phrase
 * inachevée, que la relance reprend en entier dans le même message. Au-delà de
 * `maxContinuations`, le message finit sur sa dernière phrase complète, marqué `truncated`, et
 * `onTruncated` est appelé.
 */
export async function writeTurnWithContinuations({
  writer,
  history,
  runTurn,
  maxContinuations,
  onError,
  onTruncated,
}: {
  writer: { write: (chunk: UIMessageChunk) => void }
  history: ModelMessage[]
  runTurn: (history: ModelMessage[], continuing: boolean) => TurnResult
  maxContinuations: number
  onError: (error: unknown) => string
  onTruncated: (continuations: number) => void
}): Promise<void> {
  let messages = history
  let written = ''
  const write = (chunk: UIMessageChunk) => {
    if (chunk.type === 'text-delta') written += chunk.delta
    writer.write(chunk)
  }

  for (let attempt = 0; ; attempt++) {
    const continuing = attempt > 0
    const result = runTurn(messages, continuing)
    // Phrase en cours, pas encore affichée, et ce qui suit la fin de son texte : seule la
    // dernière étape d'un tour peut être coupée, la suite dit si c'était elle.
    let pending: { id: string; text: string } | null = null
    let parked: UIMessageChunk[] = []
    let opening = continuing
    const release = (id: string, text: string) => {
      const delta = opening ? stitchContinuation(written, text) : text
      opening = false
      if (delta) write({ type: 'text-delta', id, delta })
    }
    const unpark = () => {
      if (pending?.text) release(pending.id, pending.text)
      pending = null
      for (const chunk of parked) write(chunk)
      parked = []
    }
    /** Affiche les phrases complètes encore retenues et rend la phrase inachevée, retirée. */
    const takeUnfinished = () => {
      if (!pending) return ''
      const { id, text } = pending
      const end = completeSentencesLength(text)
      if (end > 0) release(id, text.slice(0, end))
      pending = null
      return text.slice(end)
    }

    for await (const chunk of result.toUIMessageStream({
      sendStart: !continuing,
      sendFinish: false,
      onError,
    })) {
      // Sans marqueur d'étape, le texte relancé suit le texte coupé dans le message.
      if (continuing && chunk.type === 'start-step') continue
      if (parked.length > 0) {
        if (chunk.type === 'finish-step') {
          parked.push(chunk)
          continue
        }
        unpark()
      }
      if (chunk.type === 'text-delta') {
        const text: string = (pending?.text ?? '') + chunk.delta
        // La relance attend d'en savoir assez pour retirer une phrase qu'elle répéterait.
        const end = opening && text.length < STITCH_WINDOW ? 0 : completeSentencesLength(text)
        if (end > 0) release(chunk.id, text.slice(0, end))
        pending = { id: chunk.id, text: text.slice(end) }
        continue
      }
      if (chunk.type === 'text-end' && pending?.text) {
        parked.push(chunk)
        continue
      }
      write(chunk)
    }

    const steps = await Promise.resolve(result.steps).catch(() => [])
    if (!endedMidText(steps)) {
      unpark()
      break
    }
    const unfinished = takeUnfinished()
    unpark()
    if (attempt >= maxContinuations) {
      writer.write({ type: 'message-metadata', messageMetadata: { truncated: true } })
      onTruncated(attempt)
      break
    }
    const { messages: response } = await result.response
    messages = continuationMessages(messages, withoutUnfinishedSentence(response, unfinished))
  }
  writer.write({ type: 'finish' })
}
