export type SimpleInlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: SimpleInlineNode[] }
  | { type: 'emphasis'; children: SimpleInlineNode[] }

export function parseSimpleInline(value: string): SimpleInlineNode[] {
  return parseUntil(value, 0).nodes
}

function parseUntil(
  value: string,
  start: number,
  closing?: '**' | '_'
): { nodes: SimpleInlineNode[]; position: number } {
  const nodes: SimpleInlineNode[] = []
  let text = ''
  let position = start

  const flushText = () => {
    if (!text) return
    nodes.push({ type: 'text', value: text })
    text = ''
  }

  while (position < value.length) {
    if (closing && value.startsWith(closing, position)) {
      flushText()
      return { nodes, position: position + closing.length }
    }

    const delimiter = value.startsWith('**', position) ? '**' : value[position] === '_' ? '_' : null
    if (!delimiter) {
      text += value[position]
      position += 1
      continue
    }

    const closingIndex = value.indexOf(delimiter, position + delimiter.length)
    if (closingIndex === -1) {
      text += delimiter
      position += delimiter.length
      continue
    }

    flushText()
    const parsed = parseUntil(value, position + delimiter.length, delimiter)
    nodes.push({
      type: delimiter === '**' ? 'strong' : 'emphasis',
      children: parsed.nodes,
    })
    position = parsed.position
  }

  flushText()
  return { nodes, position }
}
